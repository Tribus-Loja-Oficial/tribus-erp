import { eq, desc, and } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  purchaseOrders,
  purchaseOrderItems,
  type NewPurchaseOrder,
  type NewPurchaseOrderItem,
} from "../db/schema/index.js";

export function createPurchaseRepository(db: AppDb) {
  return {
    async insert(data: NewPurchaseOrder) {
      const [row] = await db.insert(purchaseOrders).values(data).returning();
      return row!;
    },

    async insertItem(data: NewPurchaseOrderItem) {
      const [row] = await db.insert(purchaseOrderItems).values(data).returning();
      return row!;
    },

    async findById(id: string) {
      const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
      return row ?? null;
    },

    async findItemsByOrder(purchaseOrderId: string) {
      return db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
    },

    async findMany(params: { status?: string; supplierId?: string; limit: number; offset: number }) {
      const conditions = [];
      if (params.status) conditions.push(eq(purchaseOrders.status, params.status as "draft" | "ordered" | "partially_received" | "received" | "cancelled"));
      if (params.supplierId) conditions.push(eq(purchaseOrders.supplierId, params.supplierId));

      return db
        .select()
        .from(purchaseOrders)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(params.limit)
        .offset(params.offset);
    },

    async update(id: string, data: Partial<NewPurchaseOrder>) {
      const [row] = await db
        .update(purchaseOrders)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(purchaseOrders.id, id))
        .returning();
      return row!;
    },

    async updateItem(id: string, data: Partial<NewPurchaseOrderItem>) {
      const [row] = await db
        .update(purchaseOrderItems)
        .set(data)
        .where(eq(purchaseOrderItems.id, id))
        .returning();
      return row!;
    },
  };
}
