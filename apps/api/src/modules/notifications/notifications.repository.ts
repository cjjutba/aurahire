import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, isNull, lt, sql, inArray } from "drizzle-orm";
import {
  notificationsTable,
  type NewNotification,
  type Notification,
} from "@aurahire/db";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insertOne(input: NewNotification): Promise<Notification> {
    const [row] = await this.db.insert(notificationsTable).values(input).returning();
    if (!row) throw new Error("Notification insert failed");
    return row;
  }

  async insertMany(inputs: NewNotification[]): Promise<Notification[]> {
    if (inputs.length === 0) return [];
    return this.db.insert(notificationsTable).values(inputs).returning();
  }

  async findById(id: string): Promise<Notification | null> {
    const [row] = await this.db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt),
          isNull(notificationsTable.dismissedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async listForUser(
    userId: string,
    params: { tab: "inbox" | "archive"; limit: number; cursor?: string },
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    // Tab semantics (popover-aligned):
    //   - `inbox`   → rows where dismissed_at IS NULL  (active items)
    //   - `archive` → rows where dismissed_at IS NOT NULL (archived items)
    // The previous `unread | all` split has been retired in favor of the
    // popover's two-tab vocabulary; "unread" is surfaced separately via
    // `GET /notifications/unread-count`.
    const conditions = [
      eq(notificationsTable.userId, userId),
      params.tab === "archive"
        ? isNotNull(notificationsTable.dismissedAt)
        : isNull(notificationsTable.dismissedAt),
    ];
    if (params.cursor) {
      const decoded = Buffer.from(params.cursor, "base64").toString("utf-8");
      const [createdAtIso, id] = decoded.split("|");
      conditions.push(
        sql`(${notificationsTable.createdAt}, ${notificationsTable.id}) < (${createdAtIso}::timestamptz, ${id}::uuid)`,
      );
    }
    const rows = await this.db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
      .limit(params.limit + 1);

    const hasMore = rows.length > params.limit;
    const items = hasMore ? rows.slice(0, params.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64")
        : null;
    return { items, nextCursor };
  }

  async markRead(id: string, userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    const unreadCount = await this.countUnread(userId);
    return { unreadCount };
  }

  async markAllRead(userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.readAt),
          isNull(notificationsTable.dismissedAt),
        ),
      );
    return { unreadCount: 0 };
  }

  /**
   * Archive a single notification — sets `dismissed_at = NOW()` and, for
   * unread rows, also sets `read_at = NOW()` so archived items are never
   * left in an "unread but hidden" limbo. The popover's vocabulary calls
   * this "archive"; `dismiss` remains as a thin alias for backward
   * compatibility while existing callers migrate.
   *
   * Per Task 1's discovery the column is `dismissed_at` (not
   * `archived_at`) — keep the DB column intact.
   */
  async archive(id: string, userId: string): Promise<{ unreadCount: number }> {
    await this.db
      .update(notificationsTable)
      .set({
        dismissedAt: new Date(),
        readAt: sql`COALESCE(${notificationsTable.readAt}, NOW())`,
      })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    const unreadCount = await this.countUnread(userId);
    return { unreadCount };
  }

  /**
   * Backward-compatible alias for {@link archive}. Existing callers (older
   * controllers, queue consumers, tests) used `dismiss` before the popover
   * settled on "archive" as user-visible vocabulary. Forward to keep the
   * vocabulary single while not breaking call sites.
   */
  async dismiss(id: string, userId: string): Promise<{ unreadCount: number }> {
    return this.archive(id, userId);
  }

  /**
   * Archive every undismissed notification for the user. Mirrors
   * {@link archive}'s "also mark unread rows as read" behavior so the
   * unread count drops to zero in one trip and the inbox lands in a clean
   * state.
   */
  async archiveAllForUser(userId: string): Promise<{ unreadCount: 0 }> {
    await this.db
      .update(notificationsTable)
      .set({
        dismissedAt: new Date(),
        readAt: sql`COALESCE(${notificationsTable.readAt}, NOW())`,
      })
      .where(
        and(
          eq(notificationsTable.userId, userId),
          isNull(notificationsTable.dismissedAt),
        ),
      );
    return { unreadCount: 0 };
  }

  async setDigestPending(id: string, value: boolean): Promise<void> {
    await this.db
      .update(notificationsTable)
      .set({ digestPending: value })
      .where(eq(notificationsTable.id, id));
  }

  async setEmailSent(id: string): Promise<void> {
    await this.db
      .update(notificationsTable)
      .set({ emailSentAt: new Date() })
      .where(eq(notificationsTable.id, id));
  }

  async findDigestPendingByUser(): Promise<Array<{ userId: string; ids: string[] }>> {
    const rows = await this.db
      .select({ id: notificationsTable.id, userId: notificationsTable.userId })
      .from(notificationsTable)
      .where(eq(notificationsTable.digestPending, true));
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const arr = grouped.get(row.userId) ?? [];
      arr.push(row.id);
      grouped.set(row.userId, arr);
    }
    return Array.from(grouped.entries()).map(([userId, ids]) => ({ userId, ids }));
  }

  async clearDigestPending(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(notificationsTable)
      .set({ digestPending: false })
      .where(inArray(notificationsTable.id, ids));
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db
      .delete(notificationsTable)
      .where(lt(notificationsTable.createdAt, cutoff));
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}
