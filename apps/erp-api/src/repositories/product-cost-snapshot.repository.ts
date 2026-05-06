import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { productCostSnapshots, type NewProductCostSnapshot } from "../db/schema/index.js";

export function createProductCostSnapshotRepository(db: AppDb) {
  return {
    async insert(data: NewProductCostSnapshot) {
      const [row] = await db.insert(productCostSnapshots).values(data).returning();
      return row!;
    },

    async findByProduct(params: {
      productId: string;
      source?: string;
      from?: string;
      to?: string;
      limit: number;
      offset: number;
    }) {
      const where = and(
        eq(productCostSnapshots.productId, params.productId),
        params.source ? eq(productCostSnapshots.source, params.source as never) : undefined,
        params.from ? gte(productCostSnapshots.snapshotDate, params.from) : undefined,
        params.to ? lte(productCostSnapshots.snapshotDate, params.to) : undefined,
      );
      const [totalRow] = await db
        .select({ total: count() })
        .from(productCostSnapshots)
        .where(where);
      const items = await db
        .select()
        .from(productCostSnapshots)
        .where(where)
        .orderBy(desc(productCostSnapshots.snapshotDate))
        .limit(params.limit)
        .offset(params.offset);
      return { items, total: Number(totalRow?.total ?? 0) };
    },
  };
}
