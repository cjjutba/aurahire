import { Inject, Injectable } from "@nestjs/common";
import {
  notificationPreferencesTable,
  type NotificationPreference,
  type NotificationEventType,
  type NotificationMode,
} from "@aurahire/db";
import { and, eq, inArray } from "drizzle-orm";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";

@Injectable()
export class NotificationPreferencesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findByUser(userId: string): Promise<NotificationPreference[]> {
    return this.db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId));
  }

  async findOne(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationPreference | null> {
    const [row] = await this.db
      .select()
      .from(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.userId, userId),
          eq(notificationPreferencesTable.eventType, eventType),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsert(
    userId: string,
    eventType: NotificationEventType,
    mode: NotificationMode,
  ): Promise<NotificationPreference> {
    const [row] = await this.db
      .insert(notificationPreferencesTable)
      .values({ userId, eventType, mode })
      .onConflictDoUpdate({
        target: [
          notificationPreferencesTable.userId,
          notificationPreferencesTable.eventType,
        ],
        set: { mode, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Preference upsert failed");
    return row;
  }

  async deleteForCategory(
    userId: string,
    eventTypes: NotificationEventType[],
  ): Promise<number> {
    if (eventTypes.length === 0) return 0;
    const result = await this.db
      .delete(notificationPreferencesTable)
      .where(
        and(
          eq(notificationPreferencesTable.userId, userId),
          inArray(notificationPreferencesTable.eventType, eventTypes),
        ),
      );
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.db
      .delete(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId));
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  }
}
