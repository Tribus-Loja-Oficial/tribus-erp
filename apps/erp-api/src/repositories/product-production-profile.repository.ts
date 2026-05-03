import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  productProductionProfiles,
  type ProductProductionProfile,
  type NewProductProductionProfile,
} from "../db/schema/index.js";

export function createProductProductionProfileRepository(db: AppDb) {
  return {
    async findByProductId(productId: string): Promise<ProductProductionProfile | null> {
      const rows = await db
        .select()
        .from(productProductionProfiles)
        .where(eq(productProductionProfiles.productId, productId))
        .limit(1);
      return rows[0] ?? null;
    },

    async insert(row: NewProductProductionProfile): Promise<ProductProductionProfile> {
      const result = await db.insert(productProductionProfiles).values(row).returning();
      if (!result[0]) throw new Error("Failed to insert product production profile");
      return result[0];
    },

    async update(
      id: string,
      data: Partial<Omit<NewProductProductionProfile, "id" | "productId" | "createdAt">>,
    ): Promise<ProductProductionProfile> {
      const result = await db
        .update(productProductionProfiles)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(productProductionProfiles.id, id))
        .returning();
      if (!result[0]) throw new Error(`Product production profile ${id} not found`);
      return result[0];
    },

    async upsertByProductId(
      row: Omit<NewProductProductionProfile, "createdAt"> & { createdAt?: string },
    ): Promise<ProductProductionProfile> {
      const existing = await this.findByProductId(row.productId);
      const ts = new Date().toISOString();
      if (existing) {
        return this.update(existing.id, {
          producedInternally: row.producedInternally,
          averageProductionTimeMinutes: row.averageProductionTimeMinutes,
          laborCostPerHourCents: row.laborCostPerHourCents,
          laborCostCalculatedCents: row.laborCostCalculatedCents,
          notes: row.notes,
        });
      }
      return this.insert({
        ...row,
        createdAt: row.createdAt ?? ts,
        updatedAt: row.updatedAt ?? ts,
      });
    },
  };
}
