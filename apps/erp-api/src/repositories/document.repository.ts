import { eq, desc } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { documentFiles, type DocumentFile, type NewDocumentFile } from "../db/schema/index.js";

export function createDocumentRepository(db: AppDb) {
  return {
    async findById(id: string): Promise<DocumentFile | null> {
      const result = await db.select().from(documentFiles).where(eq(documentFiles.id, id)).limit(1);
      return result[0] ?? null;
    },

    async findByReference(referenceType: string, _referenceId: string): Promise<DocumentFile[]> {
      return db
        .select()
        .from(documentFiles)
        .where(eq(documentFiles.referenceType, referenceType))
        .orderBy(desc(documentFiles.createdAt));
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
  };
}
