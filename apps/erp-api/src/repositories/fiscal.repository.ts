import { eq, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  fiscalDocuments,
  fiscalDocumentItems,
  type FiscalDocument,
  type NewFiscalDocument,
  type NewFiscalDocumentItem,
} from "../db/schema/index.js";

export function createFiscalRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<FiscalDocument | null> {
      const result = await db
        .select()
        .from(fiscalDocuments)
        .where(eq(fiscalDocuments.id, id))
        .limit(1);
      return result[0] ?? null;
    },

    async findByAccessKey(accessKey: string): Promise<FiscalDocument | null> {
      const result = await db
        .select()
        .from(fiscalDocuments)
        .where(eq(fiscalDocuments.accessKey, accessKey))
        .limit(1);
      return result[0] ?? null;
    },

    async findMany(
      params: { type?: string; limit?: number; offset?: number } = {},
    ): Promise<FiscalDocument[]> {
      const { limit = 20, offset = 0 } = params;
      return db
        .select()
        .from(fiscalDocuments)
        .orderBy(desc(fiscalDocuments.issueDate))
        .limit(limit)
        .offset(offset);
    },

    async insert(data: NewFiscalDocument): Promise<FiscalDocument> {
      const result = await db.insert(fiscalDocuments).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert fiscal document");
      return result[0];
    },

    async update(id: string, data: Partial<NewFiscalDocument>): Promise<FiscalDocument> {
      const result = await db
        .update(fiscalDocuments)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(fiscalDocuments.id, id))
        .returning();
      if (!result[0]) throw new Error(`Fiscal document ${id} not found`);
      return result[0];
    },

    async insertItem(data: NewFiscalDocumentItem) {
      const result = await db.insert(fiscalDocumentItems).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert fiscal document item");
      return result[0];
    },

    async findItemsByDocument(fiscalDocumentId: string) {
      return db
        .select()
        .from(fiscalDocumentItems)
        .where(eq(fiscalDocumentItems.fiscalDocumentId, fiscalDocumentId));
    },
  };
}
