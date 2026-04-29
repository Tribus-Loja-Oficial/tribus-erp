import { eq, and, isNull, like, or, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  parties,
  partyAddresses,
  type Party,
  type NewParty,
  type NewPartyAddress,
} from "../db/schema/index.js";

export interface ListPartiesParams {
  q?: string;
  type?: "individual" | "company";
  limit?: number;
  offset?: number;
}

export function createPartyRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<Party | null> {
      const result = await db
        .select()
        .from(parties)
        .where(and(eq(parties.id, id), isNull(parties.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findMany(params: ListPartiesParams = {}): Promise<Party[]> {
      const { q, type, limit = 20, offset = 0 } = params;
      const conditions = [isNull(parties.archivedAt)];
      if (type) conditions.push(eq(parties.type, type));
      if (q) {
        conditions.push(
          or(
            like(parties.legalName, `%${q}%`),
            like(parties.email, `%${q}%`),
            like(parties.documentNumber, `%${q}%`),
          )!,
        );
      }
      return db
        .select()
        .from(parties)
        .where(and(...conditions))
        .orderBy(desc(parties.updatedAt))
        .limit(limit)
        .offset(offset);
    },

    async findByCdsConsumerId(cdsConsumerId: string): Promise<Party | null> {
      const result = await db
        .select()
        .from(parties)
        .where(and(eq(parties.cdsConsumerId, cdsConsumerId), isNull(parties.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async insert(data: NewParty): Promise<Party> {
      const result = await db.insert(parties).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert party");
      return result[0];
    },

    async update(id: string, data: Partial<NewParty>): Promise<Party> {
      const result = await db
        .update(parties)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(parties.id, id))
        .returning();
      if (!result[0]) throw new Error(`Party ${id} not found`);
      return result[0];
    },

    async archive(id: string): Promise<void> {
      await db
        .update(parties)
        .set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(parties.id, id));
    },

    async insertAddress(data: NewPartyAddress) {
      const result = await db.insert(partyAddresses).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert address");
      return result[0];
    },

    async findAddressesByParty(partyId: string) {
      return db.select().from(partyAddresses).where(eq(partyAddresses.partyId, partyId));
    },
  };
}
