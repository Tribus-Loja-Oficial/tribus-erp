import { z } from "zod";
import type { ZodIssue } from "zod";
import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { createProductService } from "./product.service.js";
import { createProductMediaService } from "./product-media.service.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { ValidationError } from "../errors/app-error.js";
import { createProductSchema, type CreateProductInput } from "../schemas/product.schemas.js";
import type {
  IngestionPayload,
  IngestionObject,
  IngestionObjectType,
  ProductIngestionData,
} from "../schemas/ingestion.schemas.js";

export type ValidationIssue = {
  objectIndex?: number;
  objectType?: IngestionObjectType;
  clientRef?: string;
  field?: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    total: number;
    byType: Record<string, number>;
  };
};

export type IngestionItemResult = {
  index: number;
  type: IngestionObjectType;
  clientRef?: string;
  status: "created" | "failed";
  id?: string;
  error?: string;
  warnings?: string[];
};

export type IngestionResult = {
  total: number;
  created: number;
  failed: number;
  items: IngestionItemResult[];
  refMap: Record<string, string>;
};

const TYPE_ORDER: Record<IngestionObjectType, number> = {
  product: 0,
};

function sortByDependency(objects: IngestionObject[]): IngestionObject[] {
  return [...objects].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
}

function stripProductIngestionUrls(data: ProductIngestionData): CreateProductInput {
  const { main_image_url: _m, gallery_image_urls: _g, ...rest } = data;
  return createProductSchema.parse(rest);
}

function semanticIssuesToZodIssues(errors: ValidationIssue[]): ZodIssue[] {
  return errors.map((e) => ({
    code: z.ZodIssueCode.custom,
    message: e.message,
    path:
      e.field != null && e.field.length > 0
        ? e.field.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p))
        : e.objectIndex !== undefined
          ? ["objects", e.objectIndex]
          : [],
  }));
}

export function validateIngestionPayload(payload: IngestionPayload): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const objects = payload.objects;
  const clientRefs = new Map<string, { index: number; type: IngestionObjectType }>();

  objects.forEach((obj, i) => {
    if (obj.client_ref) {
      if (clientRefs.has(obj.client_ref)) {
        errors.push({
          objectIndex: i,
          objectType: obj.type,
          clientRef: obj.client_ref,
          message: `client_ref "${obj.client_ref}" duplicado. Cada client_ref deve ser único no payload.`,
        });
      } else {
        clientRefs.set(obj.client_ref, { index: i, type: obj.type });
      }
    }
  });

  const byType: Record<string, number> = {};
  for (const obj of objects) {
    byType[obj.type] = (byType[obj.type] ?? 0) + 1;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: { total: objects.length, byType },
  };
}

async function applyProductImagesFromUrls(
  media: ReturnType<typeof createProductMediaService>,
  productService: ReturnType<typeof createProductService>,
  productId: string,
  data: ProductIngestionData,
): Promise<string[]> {
  const warnings: string[] = [];
  const existing = await productService.findById(productId);
  let galleryIds: string[] = [];
  try {
    galleryIds = existing.imagesJson ? (JSON.parse(existing.imagesJson) as string[]) : [];
  } catch {
    galleryIds = [];
  }

  if (data.main_image_url) {
    try {
      const doc = await media.uploadProductImageFromUrl({
        url: data.main_image_url,
        productId,
      });
      await productService.update(productId, { mainImageFileId: doc.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      warnings.push(`Imagem principal (URL): ${msg}`);
    }
  }

  for (let i = 0; i < (data.gallery_image_urls?.length ?? 0); i++) {
    const url = data.gallery_image_urls![i]!;
    try {
      const doc = await media.uploadProductImageFromUrl({ url, productId });
      galleryIds.push(doc.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      warnings.push(`Galeria URL #${i + 1}: ${msg}`);
    }
  }

  if (data.gallery_image_urls?.length) {
    await productService.update(productId, { imagesJson: galleryIds });
  }

  return warnings;
}

async function createProductIngestionItem(
  obj: Extract<IngestionObject, { type: "product" }>,
  ctx: {
    productService: ReturnType<typeof createProductService>;
    media: ReturnType<typeof createProductMediaService> | null;
  },
): Promise<{ id: string; warnings: string[] }> {
  const input = stripProductIngestionUrls(obj.data);
  const product = await ctx.productService.create(input);
  const warnings: string[] = [];

  const hasUrls = Boolean(obj.data.main_image_url || obj.data.gallery_image_urls?.length);
  if (hasUrls && !ctx.media) {
    if (obj.data.main_image_url) {
      warnings.push("Imagem principal (URL): armazenamento R2 indisponível neste ambiente.");
    }
    (obj.data.gallery_image_urls ?? []).forEach((_, i) => {
      warnings.push(`Galeria URL #${i + 1}: armazenamento R2 indisponível neste ambiente.`);
    });
    return { id: product.id, warnings };
  }

  if (hasUrls && ctx.media) {
    const w = await applyProductImagesFromUrls(ctx.media, ctx.productService, product.id, obj.data);
    warnings.push(...w);
  }

  return { id: product.id, warnings };
}

async function createIngestionObject(
  obj: IngestionObject,
  ctx: {
    productService: ReturnType<typeof createProductService>;
    media: ReturnType<typeof createProductMediaService> | null;
  },
): Promise<{ id: string; warnings: string[] }> {
  if (obj.type === "product") {
    return createProductIngestionItem(obj, ctx);
  }
  throw new Error(`Tipo de ingestão não suportado: ${(obj as IngestionObject).type}`);
}

export function createIngestionService(db: AppDb, storage: StorageProvider | undefined) {
  const productService = createProductService(db);
  const media = storage ? createProductMediaService(db, storage) : null;
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    validateIngestionPayload,

    async executeIngestion(
      payload: IngestionPayload,
      options?: { actorId?: string | null },
    ): Promise<IngestionResult> {
      const validation = validateIngestionPayload(payload);
      if (!validation.valid) {
        throw new ValidationError(
          "Payload de ingestão inválido",
          semanticIssuesToZodIssues(validation.errors),
        );
      }

      const sortedObjects = sortByDependency(payload.objects);
      const refMap: Record<string, string> = {};
      const items: IngestionItemResult[] = [];
      let created = 0;
      let failed = 0;

      const originalIndexMap = new Map<IngestionObject, number>(
        payload.objects.map((obj, i) => [obj, i]),
      );

      const ctx = { productService, media };

      for (const obj of sortedObjects) {
        const originalIndex = originalIndexMap.get(obj) ?? -1;
        const itemBase: Omit<IngestionItemResult, "status" | "id" | "error" | "warnings"> = {
          index: originalIndex,
          type: obj.type,
          clientRef: obj.client_ref,
        };

        try {
          const { id, warnings } = await createIngestionObject(obj, ctx);
          if (obj.client_ref) refMap[obj.client_ref] = id;
          items.push({
            ...itemBase,
            status: "created",
            id,
            warnings: warnings.length ? warnings : undefined,
          });
          created++;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro desconhecido";
          items.push({ ...itemBase, status: "failed", error: message });
          failed++;
        }
      }

      items.sort((a, b) => a.index - b.index);

      await auditRepo.insert({
        id: generateId(),
        actorId: options?.actorId ?? null,
        actorType: "api",
        action: "ingestion.executed",
        entityType: "ingestion",
        entityId: "execute",
        metadataJson: JSON.stringify({
          total: payload.objects.length,
          created,
          failed,
          byType: validation.summary.byType,
        }),
        createdAt: now(),
      });

      return { total: payload.objects.length, created, failed, items, refMap };
    },
  };
}
