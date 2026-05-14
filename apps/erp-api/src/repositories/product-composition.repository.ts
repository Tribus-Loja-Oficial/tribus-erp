import { eq, and, isNull, asc, inArray, ne, or, sql } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import type { SQL } from "drizzle-orm";
import {
  productCompositions,
  type ProductComposition,
  type NewProductComposition,
} from "../db/schema/index.js";

/** Linhas activas ao nível do produto (`parent_variant_id` nulo) dentro de `replaceTypes` e filtro opcional de canal de embalagem. */
export function activeCompositionScopeWhere(
  parentProductId: string,
  replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[],
  packagingChannel?: "online" | "presential",
): SQL {
  const base = and(
    eq(productCompositions.parentProductId, parentProductId),
    isNull(productCompositions.archivedAt),
    isNull(productCompositions.parentVariantId),
    inArray(productCompositions.compositionType, [...replaceTypes]),
    or(
      ne(productCompositions.compositionType, "packaging"),
      packagingChannel === undefined
        ? sql`1 = 1`
        : eq(productCompositions.packagingChannel, packagingChannel),
    ),
  )!;
  return base;
}

export function createProductCompositionRepository(db: AppDb) {
  return {
    async findActiveByParentId(parentProductId: string): Promise<ProductComposition[]> {
      return db
        .select()
        .from(productCompositions)
        .where(
          and(
            eq(productCompositions.parentProductId, parentProductId),
            isNull(productCompositions.parentVariantId),
            isNull(productCompositions.archivedAt),
          ),
        )
        .orderBy(asc(productCompositions.createdAt));
    },

    async findActiveByChildId(childProductId: string): Promise<ProductComposition[]> {
      return db
        .select()
        .from(productCompositions)
        .where(
          and(
            eq(productCompositions.childProductId, childProductId),
            isNull(productCompositions.parentVariantId),
            isNull(productCompositions.archivedAt),
          ),
        );
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

    async countActiveInScope(
      parentProductId: string,
      replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[],
      packagingChannel?: "online" | "presential",
    ): Promise<number> {
      const where = activeCompositionScopeWhere(parentProductId, replaceTypes, packagingChannel);
      const [row] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(productCompositions)
        .where(where);
      return row?.n ?? 0;
    },

    async archiveActiveInScope(
      parentProductId: string,
      replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[],
      packagingChannel?: "online" | "presential",
    ): Promise<void> {
      const ts = new Date().toISOString();
      const where = activeCompositionScopeWhere(parentProductId, replaceTypes, packagingChannel);
      await db.update(productCompositions).set({ archivedAt: ts, updatedAt: ts }).where(where);
    },
  };
}
