import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  stockLocations,
  stockMovements,
  type StockLocation,
  type NewStockLocation,
  type StockMovement,
  type NewStockMovement,
} from "../db/schema/index.js";

export function createInventoryRepository(db: AppDb) {
  return {
    async findLocationById(id: string): Promise<StockLocation | null> {
      const result = await db
        .select()
        .from(stockLocations)
        .where(eq(stockLocations.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findActiveLocations(): Promise<StockLocation[]> {
      return db
        .select()
        .from(stockLocations)
        .where(eq(stockLocations.isActive, true))
        .orderBy(stockLocations.name);
    },

    async insertLocation(data: NewStockLocation): Promise<StockLocation> {
      const result = await db.insert(stockLocations).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert stock location");
      return result[0];
    },

    async insertMovement(data: NewStockMovement): Promise<StockMovement> {
      const result = await db.insert(stockMovements).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert stock movement");
      return result[0];
    },

    async findMovementsByProduct(productId: string, limit = 50): Promise<StockMovement[]> {
      return db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.productId, productId))
        .orderBy(desc(stockMovements.createdAt))
        .limit(limit);
    },

    async findMovementsByLocation(locationId: string, limit = 50): Promise<StockMovement[]> {
      return db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.locationId, locationId))
        .orderBy(desc(stockMovements.createdAt))
        .limit(limit);
    },

    async findMovementsByReference(
      referenceType: string,
      referenceId: string,
    ): Promise<StockMovement[]> {
      return db
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.referenceType, referenceType),
            eq(stockMovements.referenceId, referenceId),
          ),
        );
    },

    async findRecentMovements(limit = 50): Promise<StockMovement[]> {
      return db
        .select()
        .from(stockMovements)
        .orderBy(desc(stockMovements.createdAt))
        .limit(limit);
    },
  };
}
