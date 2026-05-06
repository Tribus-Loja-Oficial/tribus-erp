import { eq, desc, and, inArray } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseReceipts,
  purchaseReceiptItems,
  inventoryValuationEvents,
  type NewPurchaseOrder,
  type NewPurchaseOrderItem,
  type NewPurchaseReceipt,
  type NewPurchaseReceiptItem,
  type NewInventoryValuationEvent,
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

    async findMany(params: {
      status?: string;
      supplierId?: string;
      limit: number;
      offset: number;
    }) {
      const conditions = [];
      if (params.status)
        conditions.push(
          eq(
            purchaseOrders.status,
            params.status as "draft" | "ordered" | "partially_received" | "received" | "cancelled",
          ),
        );
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

    async insertReceipt(data: NewPurchaseReceipt) {
      const [row] = await db.insert(purchaseReceipts).values(data).returning();
      return row!;
    },

    async insertReceiptItem(data: NewPurchaseReceiptItem) {
      const [row] = await db.insert(purchaseReceiptItems).values(data).returning();
      return row!;
    },

    async insertValuationEvent(data: NewInventoryValuationEvent) {
      const [row] = await db.insert(inventoryValuationEvents).values(data).returning();
      return row!;
    },

    async findReceipts(params: { supplierId?: string; limit: number; offset: number }) {
      const conditions = [];
      if (params.supplierId) conditions.push(eq(purchaseReceipts.supplierId, params.supplierId));
      return db
        .select()
        .from(purchaseReceipts)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(purchaseReceipts.receivedAt))
        .limit(params.limit)
        .offset(params.offset);
    },

    async findReceiptById(id: string) {
      const [row] = await db.select().from(purchaseReceipts).where(eq(purchaseReceipts.id, id));
      return row ?? null;
    },

    async findReceiptItemsByReceiptId(purchaseReceiptId: string) {
      return db
        .select()
        .from(purchaseReceiptItems)
        .where(eq(purchaseReceiptItems.purchaseReceiptId, purchaseReceiptId));
    },

    async findReceiptItemsForProduct(productId: string, limit: number) {
      return db
        .select({ item: purchaseReceiptItems, receipt: purchaseReceipts })
        .from(purchaseReceiptItems)
        .innerJoin(
          purchaseReceipts,
          eq(purchaseReceiptItems.purchaseReceiptId, purchaseReceipts.id),
        )
        .where(eq(purchaseReceiptItems.productId, productId))
        .orderBy(desc(purchaseReceipts.receivedAt), desc(purchaseReceiptItems.createdAt))
        .limit(limit);
    },

    /** Primeira entrada (mais recente) por produto, para link na composição. */
    async findLatestReceiptIdPerProductIds(productIds: string[]): Promise<Map<string, string>> {
      if (productIds.length === 0) return new Map();
      const rows = await db
        .select({
          productId: purchaseReceiptItems.productId,
          receiptId: purchaseReceiptItems.purchaseReceiptId,
          receivedAt: purchaseReceipts.receivedAt,
        })
        .from(purchaseReceiptItems)
        .innerJoin(
          purchaseReceipts,
          eq(purchaseReceiptItems.purchaseReceiptId, purchaseReceipts.id),
        )
        .where(inArray(purchaseReceiptItems.productId, productIds))
        .orderBy(desc(purchaseReceipts.receivedAt))
        .limit(400);
      const map = new Map<string, string>();
      for (const r of rows) {
        if (r.productId && !map.has(r.productId)) map.set(r.productId, r.receiptId);
      }
      return map;
    },
  };
}
