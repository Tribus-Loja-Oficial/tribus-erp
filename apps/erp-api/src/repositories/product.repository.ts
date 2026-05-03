import { eq, and, isNull, like, or, desc, inArray } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  products,
  productCategories,
  productCollections,
  type Product,
  type NewProduct,
  type NewProductCategory,
  type NewProductCollection,
} from "../db/schema/index.js";

export interface ListProductsParams {
  q?: string;
  status?: string;
  productType?: string;
  /** Tipos usados na busca de componentes para composição. */
  composeCatalog?: boolean;
  categoryId?: string;
  niche?: string;
  limit?: number;
  offset?: number;
}

export function createProductRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<Product | null> {
      const result = await db
        .select()
        .from(products)
        .where(and(eq(products.id, id), isNull(products.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findBySku(sku: string): Promise<Product | null> {
      const result = await db
        .select()
        .from(products)
        .where(and(eq(products.sku, sku), isNull(products.archivedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findMany(params: ListProductsParams = {}): Promise<Product[]> {
      const {
        q,
        status,
        productType,
        composeCatalog,
        categoryId,
        niche,
        limit = 20,
        offset = 0,
      } = params;
      const conditions = [isNull(products.archivedAt)];
      if (status) conditions.push(eq(products.status, status as Product["status"]));
      if (composeCatalog) {
        conditions.push(
          inArray(products.productType, [
            "finished_product",
            "raw_material",
            "packaging",
            "consumable",
          ]),
        );
      } else if (productType) {
        conditions.push(eq(products.productType, productType as Product["productType"]));
      }
      if (categoryId) conditions.push(eq(products.categoryId, categoryId));
      if (niche) conditions.push(eq(products.niche, niche));
      if (q) {
        conditions.push(or(like(products.name, `%${q}%`), like(products.sku, `%${q}%`))!);
      }
      return db
        .select()
        .from(products)
        .where(and(...conditions))
        .orderBy(desc(products.updatedAt))
        .limit(limit)
        .offset(offset);
    },

    async findLowStock(): Promise<Product[]> {
      const all = await db
        .select()
        .from(products)
        .where(and(eq(products.status, "active"), isNull(products.archivedAt)));
      return all.filter((p) => p.controlsStock && p.minStock > 0 && p.currentStock <= p.minStock);
    },

    async insert(data: NewProduct): Promise<Product> {
      const result = await db.insert(products).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert product");
      return result[0];
    },

    async update(id: string, data: Partial<NewProduct>): Promise<Product> {
      const result = await db
        .update(products)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(products.id, id))
        .returning();
      if (!result[0]) throw new Error(`Product ${id} not found`);
      return result[0];
    },

    async updateStock(id: string, delta: number): Promise<void> {
      const product = await this.findById(id);
      if (!product) throw new Error(`Product ${id} not found`);
      await db
        .update(products)
        .set({
          currentStock: product.currentStock + delta,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(products.id, id));
    },

    async archive(id: string): Promise<void> {
      await db
        .update(products)
        .set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(products.id, id));
    },

    async findCategoryById(id: string) {
      const result = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findCategories() {
      return db
        .select()
        .from(productCategories)
        .where(isNull(productCategories.archivedAt))
        .orderBy(productCategories.name);
    },

    async insertCategory(data: NewProductCategory) {
      const result = await db.insert(productCategories).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert category");
      return result[0];
    },

    async findCollections() {
      return db
        .select()
        .from(productCollections)
        .where(isNull(productCollections.archivedAt))
        .orderBy(productCollections.name);
    },

    async insertCollection(data: NewProductCollection) {
      const result = await db.insert(productCollections).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert collection");
      return result[0];
    },

    async findByIds(ids: string[]): Promise<Product[]> {
      if (ids.length === 0) return [];
      return db.select().from(products).where(inArray(products.id, ids));
    },
  };
}
