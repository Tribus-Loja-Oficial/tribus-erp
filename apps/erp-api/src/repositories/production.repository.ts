import { eq, desc, and, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  billOfMaterials,
  bomItems,
  productionOrders,
  productionOrderConsumptions,
  productionOrderLosses,
  type NewBillOfMaterials,
  type NewBomItem,
  type NewProductionOrder,
  type NewProductionOrderConsumption,
  type NewProductionOrderLoss,
} from "../db/schema/index.js";

export function createProductionRepository(db: AppDb) {
  return {
    async insertBom(data: NewBillOfMaterials) {
      await db.insert(billOfMaterials).values(data);
      return db.select().from(billOfMaterials).where(eq(billOfMaterials.id, data.id)).get()!;
    },

    async findBomById(id: string) {
      return db.select().from(billOfMaterials).where(eq(billOfMaterials.id, id)).get();
    },

    async findBomByProduct(productId: string) {
      return db
        .select()
        .from(billOfMaterials)
        .where(and(eq(billOfMaterials.productId, productId), isNull(billOfMaterials.archivedAt)))
        .orderBy(desc(billOfMaterials.createdAt))
        .all();
    },

    async findActiveBomByProduct(productId: string) {
      return db
        .select()
        .from(billOfMaterials)
        .where(
          and(
            eq(billOfMaterials.productId, productId),
            eq(billOfMaterials.status, "active"),
            isNull(billOfMaterials.archivedAt),
          ),
        )
        .get();
    },

    async insertBomItem(data: NewBomItem) {
      await db.insert(bomItems).values(data);
      return db.select().from(bomItems).where(eq(bomItems.id, data.id)).get()!;
    },

    async findBomItems(bomId: string) {
      return db.select().from(bomItems).where(eq(bomItems.bomId, bomId)).all();
    },

    async insertProductionOrder(data: NewProductionOrder) {
      await db.insert(productionOrders).values(data);
      return db.select().from(productionOrders).where(eq(productionOrders.id, data.id)).get()!;
    },

    async findProductionOrderById(id: string) {
      return db.select().from(productionOrders).where(eq(productionOrders.id, id)).get();
    },

    async findProductionOrders(params?: { status?: string; limit?: number; offset?: number }) {
      const limit = params?.limit ?? 20;
      const offset = params?.offset ?? 0;
      return db
        .select()
        .from(productionOrders)
        .where(
          and(
            isNull(productionOrders.archivedAt),
            params?.status
              ? eq(productionOrders.status, params.status as "planned" | "in_progress" | "completed" | "cancelled")
              : undefined,
          ),
        )
        .orderBy(desc(productionOrders.createdAt))
        .limit(limit)
        .offset(offset)
        .all();
    },

    async updateProductionOrder(id: string, data: Partial<NewProductionOrder>) {
      await db.update(productionOrders).set(data).where(eq(productionOrders.id, id));
      return db.select().from(productionOrders).where(eq(productionOrders.id, id)).get()!;
    },

    async generateOrderNumber() {
      const count = await db
        .select()
        .from(productionOrders)
        .all();
      return `PROD-${String(count.length + 1).padStart(5, "0")}`;
    },

    async insertConsumption(data: NewProductionOrderConsumption) {
      await db.insert(productionOrderConsumptions).values(data);
      return db.select().from(productionOrderConsumptions).where(eq(productionOrderConsumptions.id, data.id)).get()!;
    },

    async findConsumptionsByOrder(productionOrderId: string) {
      return db
        .select()
        .from(productionOrderConsumptions)
        .where(eq(productionOrderConsumptions.productionOrderId, productionOrderId))
        .all();
    },

    async insertLoss(data: NewProductionOrderLoss) {
      await db.insert(productionOrderLosses).values(data);
      return db.select().from(productionOrderLosses).where(eq(productionOrderLosses.id, data.id)).get()!;
    },

    async findLossesByOrder(productionOrderId: string) {
      return db
        .select()
        .from(productionOrderLosses)
        .where(eq(productionOrderLosses.productionOrderId, productionOrderId))
        .all();
    },
  };
}
