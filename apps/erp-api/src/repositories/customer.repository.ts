import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  customers,
  parties,
  type Customer,
  type NewCustomer,
  type Party,
} from "../db/schema/index.js";

export interface ListCustomersParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export function createCustomerRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<Customer | null> {
      const result = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), isNull(customers.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByPartyId(partyId: string): Promise<Customer | null> {
      const result = await db
        .select()
        .from(customers)
        .where(and(eq(customers.partyId, partyId), isNull(customers.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByCdsConsumerId(cdsConsumerId: string): Promise<Customer | null> {
      const result = await db
        .select()
        .from(customers)
        .where(and(eq(customers.cdsConsumerId, cdsConsumerId), isNull(customers.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findMany(params: ListCustomersParams = {}): Promise<Customer[]> {
      const { status, limit = 20, offset = 0 } = params;
      const conditions = [isNull(customers.archivedAt)];
      if (status) conditions.push(eq(customers.status, status as Customer["status"]));
      return db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.updatedAt))
        .limit(limit)
        .offset(offset);
    },

    async findManyWithParty(
      params: ListCustomersParams = {},
    ): Promise<Array<{ customer: Customer; party: Party }>> {
      const { status, limit = 20, offset = 0 } = params;
      const conditions = [isNull(customers.archivedAt), isNull(parties.archivedAt)];
      if (status) conditions.push(eq(customers.status, status as Customer["status"]));
      const rows = await db
        .select({ customer: customers, party: parties })
        .from(customers)
        .innerJoin(parties, eq(customers.partyId, parties.id))
        .where(and(...conditions))
        .orderBy(desc(customers.updatedAt))
        .limit(limit)
        .offset(offset);
      return rows;
    },

    async insert(data: NewCustomer): Promise<Customer> {
      const result = await db.insert(customers).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert customer");
      return result[0];
    },

    async update(id: string, data: Partial<NewCustomer>): Promise<Customer> {
      const result = await db
        .update(customers)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(customers.id, id))
        .returning();
      if (!result[0]) throw new Error(`Customer ${id} not found`);
      return result[0];
    },

    async incrementOrderStats(id: string, amountCents: number): Promise<void> {
      const customer = await this.findById(id);
      if (!customer) return;
      const now = new Date().toISOString();
      await db
        .update(customers)
        .set({
          totalOrders: customer.totalOrders + 1,
          totalSpentCents: customer.totalSpentCents + amountCents,
          lastPurchaseAt: now,
          firstPurchaseAt: customer.firstPurchaseAt ?? now,
          updatedAt: now,
        })
        .where(eq(customers.id, id));
    },

    async archive(id: string): Promise<void> {
      await db
        .update(customers)
        .set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(customers.id, id));
    },
  };
}
