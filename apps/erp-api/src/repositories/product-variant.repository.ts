import { eq, and, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  productVariants,
  type ProductVariant,
  type NewProductVariant,
} from "../db/schema/index.js";

export function createProductVariantRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<ProductVariant | null> {
      const result = await db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.id, id), isNull(productVariants.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByProduct(productId: string): Promise<ProductVariant[]> {
      return db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, productId), isNull(productVariants.archivedAt)));
    },

    async insert(data: NewProductVariant): Promise<ProductVariant> {
      const result = await db.insert(productVariants).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert variant");
      return result[0];
    },

    async update(id: string, data: Partial<NewProductVariant>): Promise<ProductVariant> {
      const result = await db
        .update(productVariants)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(productVariants.id, id))
        .returning();
      if (!result[0]) throw new Error(`Variant ${id} not found`);
      return result[0];
    },

    async updateStock(id: string, delta: number): Promise<void> {
      const variant = await this.findById(id);
      if (!variant) throw new Error(`Variant ${id} not found`);
      await db
        .update(productVariants)
        .set({
          currentStock: variant.currentStock + delta,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productVariants.id, id));
    },
  };
}
