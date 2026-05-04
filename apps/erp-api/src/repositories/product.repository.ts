import {
  eq,
  and,
  isNull,
  isNotNull,
  like,
  or,
  desc,
  asc,
  inArray,
  gt,
  lte,
  ne,
  count,
  sql,
} from "drizzle-orm";
import {
  orderItems,
  fiscalDocumentItems,
  purchaseOrderItems,
  stockMovements,
  productVariants,
  productionOrders,
  productionOrderConsumptions,
  productionOrderLosses,
  billOfMaterials,
  bomItems,
  productCompositions,
  productProductionProfiles,
  productTagAssignments,
} from "../db/schema/index.js";
import type { SQL } from "drizzle-orm";
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
import type {
  ProductListChannelFilter,
  ProductListProductKindFilter,
  ProductListSortField,
  ProductListStockFilter,
} from "../domain/product-list.types.js";

export interface ListProductsParams {
  q?: string;
  status?: string;
  productType?: string;
  composeCatalog?: boolean;
  categoryId?: string;
  niche?: string;
  productKind?: ProductListProductKindFilter;
  stockFilter?: ProductListStockFilter;
  channel?: ProductListChannelFilter;
  sortField?: ProductListSortField;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

function sanitizeSearchTerm(raw: string): string {
  return raw.trim().replace(/[%_]/g, "").slice(0, 200);
}

function buildListConditions(params: ListProductsParams): SQL[] {
  const {
    q,
    status,
    productType,
    composeCatalog,
    categoryId,
    niche,
    productKind,
    stockFilter,
    channel,
  } = params;

  const conditions: SQL[] = [];
  const archivedOnly = status === "archived";

  if (archivedOnly) {
    conditions.push(or(isNotNull(products.archivedAt), eq(products.status, "archived"))!);
  } else {
    conditions.push(isNull(products.archivedAt));
    if (status) {
      conditions.push(eq(products.status, status as Product["status"]));
    }
  }

  // Catálogo para composição / filtros de stock e canal são para listagem operacional;
  // com `status=archived` ignoramos para não esconder arquivos por filtros herdados na URL.
  if (!archivedOnly && composeCatalog) {
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
  if (productKind) conditions.push(eq(products.productKind, productKind));

  if (q) {
    const term = sanitizeSearchTerm(q);
    if (term.length > 0) {
      const pattern = `%${term}%`;
      conditions.push(
        or(
          like(products.sku, pattern),
          like(products.name, pattern),
          like(products.internalName, pattern),
          like(products.description, pattern),
        )!,
      );
    }
  }

  if (!archivedOnly && stockFilter) {
    switch (stockFilter) {
      case "in_stock":
        conditions.push(eq(products.controlsStock, true));
        conditions.push(gt(products.currentStock, 0));
        break;
      case "out_of_stock":
        conditions.push(eq(products.controlsStock, true));
        conditions.push(eq(products.currentStock, 0));
        break;
      case "below_min":
        conditions.push(eq(products.controlsStock, true));
        conditions.push(gt(products.minStock, 0));
        conditions.push(lte(products.currentStock, products.minStock));
        break;
      case "not_controlled":
        conditions.push(eq(products.controlsStock, false));
        break;
    }
  }

  if (!archivedOnly && channel) {
    switch (channel as ProductListChannelFilter) {
      case "sellable":
        conditions.push(eq(products.sellable, true));
        break;
      case "ecommerce":
        conditions.push(eq(products.availableForEcommerce, true));
        break;
      case "pos":
        conditions.push(eq(products.availableForPos, true));
        break;
      case "events":
        conditions.push(eq(products.availableForEvents, true));
        break;
    }
  }

  return conditions;
}

function orderByClause(sortField?: ProductListSortField, sortDir?: "asc" | "desc") {
  if (!sortField || !sortDir) {
    return [desc(products.updatedAt)];
  }
  const dir = sortDir === "asc" ? asc : desc;
  switch (sortField) {
    case "sku":
      return [dir(products.sku)];
    case "externalRef":
      return [dir(products.externalRef)];
    case "name":
      return [dir(products.name)];
    case "type":
      return [dir(products.productType)];
    case "status":
      return [dir(products.status)];
    case "salePrice":
      return [dir(products.salePriceCents)];
    case "stock":
      return [dir(products.currentStock)];
    case "updatedAt":
      return [dir(products.updatedAt)];
    default:
      return [desc(products.updatedAt)];
  }
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

    async findByIdIncludingArchived(id: string): Promise<Product | null> {
      const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
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

    async listPaginated(
      params: ListProductsParams = {},
    ): Promise<{ items: Product[]; total: number }> {
      const { limit = 20, offset = 0, sortField, sortDir } = params;
      const conditions = buildListConditions(params);
      const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

      const [countRow] = await db.select({ total: count() }).from(products).where(whereExpr);
      const total = Number(countRow?.total ?? 0);

      const items = await db
        .select()
        .from(products)
        .where(whereExpr)
        .orderBy(...orderByClause(sortField, sortDir))
        .limit(limit)
        .offset(offset);

      return { items, total };
    },

    /** @deprecated Prefer listPaginated; mantido para chamadas legadas que só precisam de linhas sem total. */
    async findMany(params: ListProductsParams = {}): Promise<Product[]> {
      const { items } = await this.listPaginated(params);
      return items;
    },

    async findLowStock(): Promise<Product[]> {
      const all = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.status, "active"),
            isNull(products.archivedAt),
            eq(products.productKind, "simple"),
          ),
        );
      return all.filter((p) => p.controlsStock && p.minStock > 0 && p.currentStock <= p.minStock);
    },

    /** Próxima referência humana `PRD-NNNN` (máx. 9999 por prefixo). */
    async allocateNextExternalRef(): Promise<string> {
      const prefix = "PRD";
      const pattern = `${prefix}-____`;
      const [row] = await db
        .select({
          maxSeq: sql<number | null>`MAX(CAST(SUBSTR(${products.externalRef}, 5) AS INTEGER))`,
        })
        .from(products)
        .where(like(products.externalRef, pattern));
      const next = Number(row?.maxSeq ?? 0) + 1;
      if (next > 9999) {
        throw new Error(`${prefix} ref limit reached (max ${prefix}-9999)`);
      }
      return `${prefix}-${String(next).padStart(4, "0")}`;
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
      if (product.productKind === "variable") {
        throw new Error("Estoque de produto variável é só nas variações");
      }
      await db
        .update(products)
        .set({
          currentStock: product.currentStock + delta,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(products.id, id));
    },

    /** Atualiza `products.current_stock` com a soma das variações ativas (produto variável). */
    async syncAggregatedStockFromVariants(productId: string): Promise<void> {
      const [row] = await db
        .select({ kind: products.productKind })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (!row || row.kind !== "variable") return;

      const [agg] = await db
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

      const sum = Number(agg?.s ?? 0);
      const now = new Date().toISOString();
      await db
        .update(products)
        .set({ currentStock: sum, updatedAt: now })
        .where(eq(products.id, productId));
    },

    async archive(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db
        .update(products)
        .set({
          archivedAt: now,
          status: "archived",
          updatedAt: now,
        })
        .where(eq(products.id, id));
    },

    async restore(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db
        .update(products)
        .set({
          archivedAt: null,
          status: "draft",
          updatedAt: now,
        })
        .where(eq(products.id, id));
    },

    async archiveMany(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const now = new Date().toISOString();
      const result = await db
        .update(products)
        .set({ archivedAt: now, status: "archived", updatedAt: now })
        .where(and(inArray(products.id, ids), isNull(products.archivedAt)))
        .returning({ id: products.id });
      return result.length;
    },

    async restoreMany(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const now = new Date().toISOString();
      const result = await db
        .update(products)
        .set({ archivedAt: null, status: "draft", updatedAt: now })
        .where(and(inArray(products.id, ids), isNotNull(products.archivedAt)))
        .returning({ id: products.id });
      return result.length;
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

    /**
     * Apaga o produto e dados “próprios” (cascata). Preserva pedidos/faturas/compras anulando `product_id` onde permitido.
     */
    async permanentDeleteCascade(productId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const variantRows = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.productId, productId));
        const variantIds = variantRows.map((r) => r.id);

        const orderItemCond =
          variantIds.length > 0
            ? or(eq(orderItems.productId, productId), inArray(orderItems.variantId, variantIds))!
            : eq(orderItems.productId, productId);
        await tx.update(orderItems).set({ productId: null, variantId: null }).where(orderItemCond);

        await tx
          .update(fiscalDocumentItems)
          .set({ productId: null })
          .where(eq(fiscalDocumentItems.productId, productId));

        await tx
          .update(purchaseOrderItems)
          .set({ productId: null })
          .where(eq(purchaseOrderItems.productId, productId));

        const smCond =
          variantIds.length > 0
            ? or(
                eq(stockMovements.productId, productId),
                inArray(stockMovements.variantId, variantIds),
              )!
            : eq(stockMovements.productId, productId);
        await tx.delete(stockMovements).where(smCond);

        /** Consumos/perdas onde este produto é matéria (OP de outro produto); sem isto a FK bloqueia o delete. */
        await tx
          .delete(productionOrderConsumptions)
          .where(eq(productionOrderConsumptions.productId, productId));
        await tx
          .delete(productionOrderLosses)
          .where(eq(productionOrderLosses.productId, productId));

        const poRows = await tx
          .select({ id: productionOrders.id })
          .from(productionOrders)
          .where(eq(productionOrders.productId, productId));
        const productionOrderIds = poRows.map((r) => r.id);
        if (productionOrderIds.length > 0) {
          await tx
            .delete(productionOrderConsumptions)
            .where(inArray(productionOrderConsumptions.productionOrderId, productionOrderIds));
          await tx
            .delete(productionOrderLosses)
            .where(inArray(productionOrderLosses.productionOrderId, productionOrderIds));
        }
        await tx.delete(productionOrders).where(eq(productionOrders.productId, productId));

        const bomRows = await tx
          .select({ id: billOfMaterials.id })
          .from(billOfMaterials)
          .where(eq(billOfMaterials.productId, productId));
        const bomIds = bomRows.map((r) => r.id);
        if (bomIds.length > 0) {
          await tx.delete(bomItems).where(inArray(bomItems.bomId, bomIds));
          await tx.delete(billOfMaterials).where(inArray(billOfMaterials.id, bomIds));
        }
        await tx.delete(bomItems).where(eq(bomItems.componentProductId, productId));

        await tx
          .delete(productCompositions)
          .where(
            or(
              eq(productCompositions.parentProductId, productId),
              eq(productCompositions.childProductId, productId),
            )!,
          );

        await tx
          .delete(productProductionProfiles)
          .where(eq(productProductionProfiles.productId, productId));

        await tx
          .delete(productTagAssignments)
          .where(eq(productTagAssignments.productId, productId));

        await tx.delete(productVariants).where(eq(productVariants.productId, productId));

        await tx.delete(products).where(eq(products.id, productId));
      });
    },
  };
}
