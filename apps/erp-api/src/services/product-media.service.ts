import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { createDocumentRepository } from "../repositories/document.repository.js";
import { createProductService } from "./product.service.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { BadRequestError, NotFoundError } from "../errors/app-error.js";
import { assertSafeHttpsImageUrl } from "../utils/safe-image-url.js";

const PRODUCT_FILE_ID_RE = /^file_[a-f0-9]{32}$/i;

const ALLOWED_MIMES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

export function createProductMediaService(db: AppDb, storage: StorageProvider) {
  const docs = createDocumentRepository(db);
  const productService = createProductService(db);
  const now = () => new Date().toISOString();

  async function uploadProductImage(input: {
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
      throw new BadRequestError(`Ficheiro demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB).`);
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
  }

  return {
    async streamByFileId(fileId: string) {
      const id = fileId.trim();
      if (!PRODUCT_FILE_ID_RE.test(id)) {
        throw new BadRequestError("Identificador de ficheiro inválido.");
      }
      const doc = await docs.findById(id);
      if (!doc) throw new NotFoundError("DocumentFile", id);
      const mime = doc.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!ALLOWED_MIMES.has(mime)) {
        throw new BadRequestError("Este endpoint só serve imagens JPEG, PNG ou WebP.");
      }
      const obj = await storage.getObject(doc.storageKey);
      if (!obj?.body) throw new NotFoundError("StoredObject", doc.storageKey);
      return {
        body: obj.body,
        contentType: doc.mimeType,
      };
    },

    uploadProductImage,

    /**
     * Descarrega uma imagem HTTPS pública, valida tamanho/MIME e persiste em R2 + document_files
     * (mesmo fluxo que multipart).
     */
    async uploadProductImageFromUrl(input: { url: string; productId?: string }) {
      let current = assertSafeHttpsImageUrl(input.url);
      let res: Response | undefined;
      let redirects = 0;

      while (true) {
        assertSafeHttpsImageUrl(current.toString());
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          res = await fetch(current.toString(), {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (res.status >= 300 && res.status < 400) {
          if (redirects >= MAX_REDIRECTS) {
            throw new BadRequestError("Demasiados redirecionamentos ao obter a imagem.");
          }
          redirects++;
          const loc = res.headers.get("location");
          if (!loc) {
            throw new BadRequestError("Redirecionamento HTTP sem cabeçalho Location.");
          }
          current = new URL(loc, current);
          continue;
        }
        break;
      }

      if (!res) throw new BadRequestError("Falha ao obter resposta HTTP.");
      if (!res.ok) {
        throw new BadRequestError(`Download da imagem falhou (HTTP ${res.status}).`);
      }

      const cl = res.headers.get("content-length");
      if (cl != null) {
        const n = Number(cl);
        if (Number.isFinite(n) && n > MAX_BYTES) {
          throw new BadRequestError(
            `Imagem demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB).`,
          );
        }
      }

      const mime = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      const ext = ALLOWED_MIMES.get(mime);
      if (!ext) {
        throw new BadRequestError("Content-Type da URL não é JPEG, PNG ou WebP.");
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        throw new BadRequestError(`Imagem demasiado grande (máx. ${MAX_BYTES / 1024 / 1024} MB).`);
      }

      const pathLast = current.pathname.split("/").filter(Boolean).pop() ?? "";
      const baseName = pathLast.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
      const filename = baseName.toLowerCase().match(/\.(jpe?g|png|webp)$/)
        ? baseName
        : `${baseName || "image"}.${ext}`;

      return uploadProductImage({
        buffer,
        filename,
        mimeType: mime,
        productId: input.productId,
      });
    },
  };
}
