import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  suppliers,
  parties,
  type Supplier,
  type NewSupplier,
  type Party,
} from "../db/schema/index.js";

export function createSupplierRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<Supplier | null> {
      const result = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, id), isNull(suppliers.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByPartyId(partyId: string): Promise<Supplier | null> {
      const result = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.partyId, partyId), isNull(suppliers.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findMany(params: { status?: string; limit?: number; offset?: number } = {}): Promise<Supplier[]> {
      const { status, limit = 20, offset = 0 } = params;
      const conditions = [isNull(suppliers.archivedAt)];
      if (status) conditions.push(eq(suppliers.status, status as Supplier["status"]));
      return db
        .select()
        .from(suppliers)
        .where(and(...conditions))
        .orderBy(desc(suppliers.updatedAt))
        .limit(limit)
        .offset(offset);
    },

    async findManyWithParty(
      params: { status?: string; limit?: number; offset?: number } = {},
    ): Promise<Array<{ supplier: Supplier; party: Party }>> {
      const { status, limit = 20, offset = 0 } = params;
      const conditions = [isNull(suppliers.archivedAt), isNull(parties.archivedAt)];
      if (status) conditions.push(eq(suppliers.status, status as Supplier["status"]));
      const rows = await db
        .select({ supplier: suppliers, party: parties })
        .from(suppliers)
        .innerJoin(parties, eq(suppliers.partyId, parties.id))
        .where(and(...conditions))
        .orderBy(desc(suppliers.updatedAt))
        .limit(limit)
        .offset(offset);
      return rows;
    },

    async insert(data: NewSupplier): Promise<Supplier> {
      const result = await db.insert(suppliers).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert supplier");
      return result[0];
    },

    async update(id: string, data: Partial<NewSupplier>): Promise<Supplier> {
      const result = await db
        .update(suppliers)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(suppliers.id, id))
        .returning();
      if (!result[0]) throw new Error(`Supplier ${id} not found`);
      return result[0];
    },

    async archive(id: string): Promise<void> {
      await db
        .update(suppliers)
        .set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(suppliers.id, id));
    },
  };
}
