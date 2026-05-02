import { eq, and, isNull, asc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  productCompositions,
  type ProductComposition,
  type NewProductComposition,
} from "../db/schema/index.js";

export function createProductCompositionRepository(db: AppDb) {
  return {
    async findActiveByParentId(parentProductId: string): Promise<ProductComposition[]> {
      return db
        .select()
        .from(productCompositions)
        .where(
          and(
            eq(productCompositions.parentProductId, parentProductId),
            isNull(productCompositions.archivedAt),
          ),
        )
        .orderBy(asc(productCompositions.createdAt));
    },

    async findById(id: string): Promise<ProductComposition | null> {
      const rows = await db
        .select()
        .from(productCompositions)
        .where(eq(productCompositions.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    async insert(row: NewProductComposition): Promise<ProductComposition> {
      const result = await db.insert(productCompositions).values(row).returning();
      if (!result[0]) throw new Error("Failed to insert product composition");
      return result[0];
    },

    async update(id: string, data: Partial<NewProductComposition>): Promise<ProductComposition> {
      const result = await db
        .update(productCompositions)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(productCompositions.id, id))
        .returning();
      if (!result[0]) throw new Error(`Composition ${id} not found`);
      return result[0];
    },

    async archive(id: string): Promise<void> {
      await db
        .update(productCompositions)
        .set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(productCompositions.id, id));
    },
  };
}
