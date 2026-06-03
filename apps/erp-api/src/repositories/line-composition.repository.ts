import { eq, and, isNull, asc, inArray, ne, or, sql } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import type { SQL } from "drizzle-orm";
import {
  lineCompositions,
  type LineComposition,
  type NewLineComposition,
} from "../db/schema/index.js";

export function activeLineCompositionScopeWhere(
  parentLineId: string,
  replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[],
  packagingChannel?: "online" | "presential" | "both",
): SQL {
  return and(
    eq(lineCompositions.parentLineId, parentLineId),
    isNull(lineCompositions.archivedAt),
    inArray(lineCompositions.compositionType, [...replaceTypes]),
    or(
      ne(lineCompositions.compositionType, "packaging"),
      packagingChannel === undefined
        ? sql`1 = 1`
        : eq(lineCompositions.packagingChannel, packagingChannel),
    ),
  )!;
}

export function createLineCompositionRepository(db: AppDb) {
  return {
    async findActiveByParentLineId(parentLineId: string): Promise<LineComposition[]> {
      return db
        .select()
        .from(lineCompositions)
        .where(
          and(eq(lineCompositions.parentLineId, parentLineId), isNull(lineCompositions.archivedAt)),
        )
        .orderBy(asc(lineCompositions.createdAt));
    },

    async findActiveByChildId(childProductId: string): Promise<LineComposition[]> {
      return db
        .select()
        .from(lineCompositions)
        .where(
          and(
            eq(lineCompositions.childProductId, childProductId),
            isNull(lineCompositions.archivedAt),
          ),
        );
    },

    async findById(id: string): Promise<LineComposition | null> {
      const rows = await db
        .select()
        .from(lineCompositions)
        .where(eq(lineCompositions.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    async insert(row: NewLineComposition): Promise<LineComposition> {
      const result = await db.insert(lineCompositions).values(row).returning();
      if (!result[0]) throw new Error("Failed to insert line composition");
      return result[0];
    },

    async update(id: string, data: Partial<NewLineComposition>): Promise<LineComposition> {
      const result = await db
        .update(lineCompositions)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(lineCompositions.id, id))
        .returning();
      if (!result[0]) throw new Error(`Line composition ${id} not found`);
      return result[0];
    },

    async archive(id: string): Promise<void> {
      await db
        .update(lineCompositions)
        .set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(lineCompositions.id, id));
    },

    async countActiveInScope(
      parentLineId: string,
      replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[],
      packagingChannel?: "online" | "presential" | "both",
    ): Promise<number> {
      const where = activeLineCompositionScopeWhere(parentLineId, replaceTypes, packagingChannel);
      const [row] = await db
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(lineCompositions)
        .where(where);
      return row?.n ?? 0;
    },
  };
}
