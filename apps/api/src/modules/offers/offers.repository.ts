import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import {
  applicationsTable,
  offersTable,
  type NewOffer,
  type Offer,
} from "@aurahire/db";

import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import type { ApplicationsTx } from "../applications/applications.repository";

@Injectable()
export class OffersRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async insert(data: NewOffer): Promise<Offer> {
    const [row] = await this.db.insert(offersTable).values(data).returning();
    if (!row) throw new Error("Offer insert failed");
    return row;
  }

  async findById(id: string): Promise<Offer | null> {
    const [row] = await this.db
      .select()
      .from(offersTable)
      .where(eq(offersTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByApplicationId(applicationId: string): Promise<Offer[]> {
    return this.db
      .select()
      .from(offersTable)
      .where(eq(offersTable.applicationId, applicationId))
      .orderBy(desc(offersTable.sentAt));
  }

  async findPendingByApplicationId(
    applicationId: string,
  ): Promise<Offer | null> {
    const [row] = await this.db
      .select()
      .from(offersTable)
      .where(
        and(
          eq(offersTable.applicationId, applicationId),
          eq(offersTable.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Most recent offer (by sentAt DESC) for an application - or null if no
   * offer has ever been sent. Used by ApplicationsService to enforce that
   * a "hired" transition requires an accepted offer. When invoked inside
   * an application-row transaction (e.g., hire()), pass `tx` so the read
   * sees the locked row's tx-scoped snapshot.
   */
  async findLatestByApplicationId(
    applicationId: string,
    tx?: ApplicationsTx,
  ): Promise<Offer | null> {
    const exec = tx ?? this.db;
    const [row] = await exec
      .select()
      .from(offersTable)
      .where(eq(offersTable.applicationId, applicationId))
      .orderBy(desc(offersTable.sentAt))
      .limit(1);
    return row ?? null;
  }

  async findByCandidateId(candidateId: string): Promise<Offer[]> {
    const rows = await this.db
      .select({ offer: offersTable })
      .from(offersTable)
      .innerJoin(
        applicationsTable,
        eq(applicationsTable.id, offersTable.applicationId),
      )
      .where(eq(applicationsTable.candidateId, candidateId))
      .orderBy(desc(offersTable.sentAt));
    return rows.map((r) => r.offer);
  }

  async update(
    id: string,
    patch: Partial<NewOffer>,
    tx?: ApplicationsTx,
  ): Promise<Offer> {
    const exec = tx ?? this.db;
    const [row] = await exec
      .update(offersTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(offersTable.id, id))
      .returning();
    if (!row) throw new Error("Offer update failed");
    return row;
  }
}
