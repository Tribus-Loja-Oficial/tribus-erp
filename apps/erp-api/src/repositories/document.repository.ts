import { eq, and, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { documentFiles, type DocumentFile, type NewDocumentFile } from "../db/schema/index.js";

export function createDocumentRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<DocumentFile | null> {
      const result = await db.select().from(documentFiles).where(eq(documentFiles.id, id)).limit(1);
      return result[0] ?? null;
    },

    async findByReference(referenceType: string, referenceId: string): Promise<DocumentFile[]> {
      return db
        .select()
        .from(documentFiles)
        .where(
          and(
            eq(documentFiles.referenceType, referenceType),
            eq(documentFiles.referenceId, referenceId),
          ),
        )
        .orderBy(desc(documentFiles.createdAt));
    },

    /** Imagens de produto ligadas por `reference_type` + `reference_id`. */
    async findProductImageFiles(productId: string): Promise<DocumentFile[]> {
      return this.findByReference("product_image", productId);
    },

    async findMany(params: { limit?: number; offset?: number } = {}): Promise<DocumentFile[]> {
      const { limit = 20, offset = 0 } = params;
      return db
        .select()
        .from(documentFiles)
        .orderBy(desc(documentFiles.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async insert(data: NewDocumentFile): Promise<DocumentFile> {
      const result = await db.insert(documentFiles).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert document file");
      return result[0];
    },

    async findByStorageKey(storageKey: string): Promise<DocumentFile | null> {
      const result = await db
        .select()
        .from(documentFiles)
        .where(eq(documentFiles.storageKey, storageKey))
        .limit(1);
      return result[0] ?? null;
    },

    async deleteById(id: string): Promise<void> {
      await db.delete(documentFiles).where(eq(documentFiles.id, id));
    },
  };
}
