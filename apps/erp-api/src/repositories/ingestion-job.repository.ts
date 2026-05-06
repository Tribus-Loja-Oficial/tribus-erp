import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { ingestionJobs } from "../db/schema/index.js";

export type IngestionJobRow = typeof ingestionJobs.$inferSelect;
export type NewIngestionJobRow = typeof ingestionJobs.$inferInsert;

export function createIngestionJobRepository(db: AppDb) {
  return {
    async insert(row: NewIngestionJobRow) {
      await db.insert(ingestionJobs).values(row);
    },

    async findById(id: string): Promise<IngestionJobRow | null> {
      const rows = await db.select().from(ingestionJobs).where(eq(ingestionJobs.id, id)).limit(1);
      return rows[0] ?? null;
    },

    async updateProgress(
      id: string,
      patch: Partial<{
        status: IngestionJobRow["status"];
        progressProcessed: number;
        progressTotal: number;
        resultJson: string | null;
        errorMessage: string | null;
        updatedAt: string;
        startedAt: string | null;
        finishedAt: string | null;
      }>,
    ) {
      await db.update(ingestionJobs).set(patch).where(eq(ingestionJobs.id, id));
    },
  };
}
