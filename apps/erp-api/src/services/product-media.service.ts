import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { createDocumentRepository } from "../repositories/document.repository.js";
import { createProductService } from "./product.service.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { BadRequestError } from "../errors/app-error.js";

const ALLOWED_MIMES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const MAX_BYTES = 5 * 1024 * 1024;

export function createProductMediaService(db: AppDb, storage: StorageProvider) {
  const docs = createDocumentRepository(db);
  const productService = createProductService(db);
  const now = () => new Date().toISOString();

  return {
    async uploadProductImage(input: {
      buffer: ArrayBuffer;
      filename: string;
      mimeType: string;
      productId?: string;
    }) {
      const mime = input.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
      const ext = ALLOWED_MIMES.get(mime);
      if (!ext) {
        throw new BadRequestError("Tipo de imagem não suportado. Use JPEG, PNG ou WebP.");
      }
      if (input.buffer.byteLength > MAX_BYTES) {
        throw new BadRequestError(
          `Ficheiro demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB).`,
        );
      }

      const hex = generateId();
      const fileId = `file_${hex}`;
      const safeName = input.filename.trim().slice(0, 500) || `upload.${ext}`;

      let storageKey: string;
      let referenceType: string;
      let referenceId: string | null;

      const pid = input.productId?.trim();
      if (pid) {
        await productService.findById(pid);
        storageKey = `products/${pid}/media/${hex}.${ext}`;
        referenceType = "product_image";
        referenceId = pid;
      } else {
        storageKey = `products/draft/${hex}.${ext}`;
        referenceType = "product_draft";
        referenceId = null;
      }

      await storage.putObject({
        key: storageKey,
        body: input.buffer,
        contentType: mime,
        metadata: { documentFileId: fileId },
      });

      return docs.insert({
        id: fileId,
        storageKey,
        filename: safeName,
        mimeType: mime,
        sizeBytes: input.buffer.byteLength,
        checksum: null,
        referenceType,
        referenceId,
        uploadedBy: null,
        metadataJson: "{}",
        createdAt: now(),
      });
    },
  };
}
