import { eq, and, isNull, inArray, sql, like, ne } from "drizzle-orm";
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

    async findByIdAny(id: string): Promise<ProductVariant | null> {
      const result = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findBySku(sku: string): Promise<ProductVariant | null> {
      const result = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, sku))
        .limit(1);
      return result[0] ?? null;
    },

    async findByProduct(productId: string): Promise<ProductVariant[]> {
      return db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, productId), isNull(productVariants.archivedAt)))
        .orderBy(productVariants.sku);
    },

    async findByProductIncludingArchived(productId: string): Promise<ProductVariant[]> {
      return db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId))
        .orderBy(productVariants.sku);
    },

    async listActiveByProductIds(productIds: string[]): Promise<ProductVariant[]> {
      if (productIds.length === 0) return [];
      return db
        .select()
        .from(productVariants)
        .where(
          and(inArray(productVariants.productId, productIds), isNull(productVariants.archivedAt)),
        );
    },

    /** Próxima referência humana `PRV-NNNN` (máx. 9999 por prefixo). */
    async allocateNextExternalRef(): Promise<string> {
      const prefix = "PRV";
      const pattern = `${prefix}-____`;
      const [row] = await db
        .select({
          maxSeq: sql<
            number | null
          >`MAX(CAST(SUBSTR(${productVariants.externalRef}, 5) AS INTEGER))`,
        })
        .from(productVariants)
        .where(like(productVariants.externalRef, pattern));
      const next = Number(row?.maxSeq ?? 0) + 1;
      if (next > 9999) {
        throw new Error(`${prefix} ref limit reached (max ${prefix}-9999)`);
      }
      return `${prefix}-${String(next).padStart(4, "0")}`;
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

    async archive(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db
        .update(productVariants)
        .set({ archivedAt: now, updatedAt: now })
        .where(eq(productVariants.id, id));
    },

    async restore(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db
        .update(productVariants)
        .set({ archivedAt: null, updatedAt: now })
        .where(eq(productVariants.id, id));
    },

    async updateStock(id: string, delta: number): Promise<void> {
      const variant = await this.findByIdAny(id);
      if (!variant) throw new Error(`Variant ${id} not found`);
      await db
        .update(productVariants)
        .set({
          currentStock: variant.currentStock + delta,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productVariants.id, id));
    },

    async sumActiveStockByProductId(productId: string): Promise<number> {
      const [row] = await db
        .select({
          s: sql<number>`COALESCE(SUM(${productVariants.currentStock}), 0)`,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, productId),
            isNull(productVariants.archivedAt),
            ne(productVariants.status, "archived"),
          ),
        );
      return Number(row?.s ?? 0);
    },

    async countActiveByProductId(productId: string): Promise<number> {
      const [row] = await db
        .select({ c: sql<number>`COUNT(*)` })
        .from(productVariants)
        .where(and(eq(productVariants.productId, productId), isNull(productVariants.archivedAt)));
      return Number(row?.c ?? 0);
    },
  };
}
