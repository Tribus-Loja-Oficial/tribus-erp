import { eq, and, isNull, desc, like } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  orders,
  orderItems,
  orderPayments,
  type Order,
  type NewOrder,
  type NewOrderItem,
  type NewOrderPayment,
} from "../db/schema/index.js";

export interface ListOrdersParams {
  status?: string;
  channel?: string;
  customerId?: string;
  limit?: number;
  offset?: number;
}

export function createOrderRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<Order | null> {
      const result = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByOrderNumber(orderNumber: string): Promise<Order | null> {
      const result = await db
        .select()
        .from(orders)
        .where(and(eq(orders.orderNumber, orderNumber), isNull(orders.deletedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findBySourceExternal(sourceSystem: string, externalId: string): Promise<Order | null> {
      const result = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.sourceSystem, sourceSystem as Order["sourceSystem"]),
            eq(orders.sourceExternalId, externalId),
            isNull(orders.deletedAt),
          ),
        )
        .limit(1);
      return result[0] ?? null;
    },

    async findMany(params: ListOrdersParams = {}): Promise<Order[]> {
      const { status, channel, customerId, limit = 20, offset = 0 } = params;
      const conditions = [isNull(orders.deletedAt)];
      if (status) conditions.push(eq(orders.status, status as Order["status"]));
      if (channel) conditions.push(eq(orders.channel, channel as Order["channel"]));
      if (customerId) conditions.push(eq(orders.customerId, customerId));
      return db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async insert(data: NewOrder): Promise<Order> {
      const result = await db.insert(orders).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert order");
      return result[0];
    },

    async update(id: string, data: Partial<NewOrder>): Promise<Order> {
      const result = await db
        .update(orders)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(orders.id, id))
        .returning();
      if (!result[0]) throw new Error(`Order ${id} not found`);
      return result[0];
    },

    async softDelete(id: string): Promise<void> {
      await db
        .update(orders)
        .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(orders.id, id));
    },

    async insertItem(data: NewOrderItem) {
      const result = await db.insert(orderItems).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert order item");
      return result[0];
    },

    async findItemsByOrder(orderId: string) {
      return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    },

    async insertPayment(data: NewOrderPayment) {
      const result = await db.insert(orderPayments).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert order payment");
      return result[0];
    },

    async findPaymentsByOrder(orderId: string) {
      return db.select().from(orderPayments).where(eq(orderPayments.orderId, orderId));
    },

    async countByStatus(): Promise<Record<string, number>> {
      const all = await db.select().from(orders).where(isNull(orders.deletedAt));
      return all.reduce(
        (acc, o) => {
          acc[o.status] = (acc[o.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    },

    async generateOrderNumber(): Promise<string> {
      const count = await db.select().from(orders);
      const next = count.length + 1;
      return `TRB-${String(next).padStart(6, "0")}`;
    },
  };
}
