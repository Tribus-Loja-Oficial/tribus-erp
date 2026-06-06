import { Hono } from "hono";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createProductService } from "../services/product.service.js";
import { toApiError } from "../errors/app-error.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  bulkProductIdsSchema,
  createCategorySchema,
  createVariantSchema,
  updateProductVariantSchema,
  createProductCompositionSchema,
  updateProductCompositionSchema,
  permanentDeleteProductSchema,
} from "../schemas/product.schemas.js";
import { createProductCompositionService } from "../services/product-composition.service.js";
import { createLineCompositionService } from "../services/line-composition.service.js";
import { createLineCompositionRepository } from "../repositories/line-composition.repository.js";
import { verifyInternalToken } from "../auth/verify-internal-token.js";
import { R2StorageProvider } from "../storage/r2-storage-provider.js";
import { createProductMediaService } from "../services/product-media.service.js";
import { createProductCostSnapshotService } from "../services/product-cost-snapshot.service.js";

const products = new Hono<{ Bindings: Env }>();

products.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = listProductsSchema.safeParse(query);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const { items, total, page, limit } = await service.listProducts(parsed.data);
    return c.json({
      data: items,
      meta: { total, page, limit },
    });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/bulk-archive", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bulkProductIdsSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const result = await service.archiveProducts(parsed.data.ids);
    return c.json({ data: result });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/bulk-restore", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bulkProductIdsSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const result = await service.restoreProducts(parsed.data.ids);
    return c.json({ data: result });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.create(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/low-stock", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findLowStock();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/categories", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findCategories();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/categories", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.createCategory(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/lines", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findLines();
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/lines/:lineId/product-ids", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findProductIdsByLine(c.req.param("lineId"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/lines/:lineId/compositions", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createLineCompositionService(db);
    const data = await service.listByLine(c.req.param("lineId"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/lines/:lineId/compositions", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createProductCompositionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createLineCompositionService(db);
    const data = await service.add(c.req.param("lineId"), parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.patch("/lines/compositions/:compositionId", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProductCompositionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const lineCompositionsRepo = createLineCompositionRepository(db);
    const row = await lineCompositionsRepo.findById(c.req.param("compositionId"));
    if (!row) return c.json({ message: "Composição não encontrada", code: "NOT_FOUND" }, 404);
    const service = createLineCompositionService(db);
    const data = await service.update(row.parentLineId, c.req.param("compositionId"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.delete("/lines/compositions/:compositionId", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const lineCompositionsRepo = createLineCompositionRepository(db);
    const row = await lineCompositionsRepo.findById(c.req.param("compositionId"));
    if (!row) return c.json({ message: "Composição não encontrada", code: "NOT_FOUND" }, 404);
    const service = createLineCompositionService(db);
    await service.archive(row.parentLineId, c.req.param("compositionId"));
    return c.json({ success: true, parentLineId: row.parentLineId });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

/** Multipart: campo `file`; opcional `productId` (texto) quando o produto já existe. */
products.post("/media/upload", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ code: "VALIDATION_ERROR", message: "Campo multipart `file` em falta." }, 400);
    }
    const productIdField = body["productId"];
    const productId =
      typeof productIdField === "string" && productIdField.trim()
        ? productIdField.trim()
        : undefined;

    const buf = await file.arrayBuffer();
    const db = createDb(config.db);
    const storage = new R2StorageProvider(config.r2);
    const mediaService = createProductMediaService(db, storage);
    const row = await mediaService.uploadProductImage({
      buffer: buf,
      filename: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      productId,
    });
    return c.json(
      {
        data: {
          id: row.id,
          storageKey: row.storageKey,
          filename: row.filename,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
        },
      },
      201,
    );
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

/** Stream binário (imagem) para pré-visualização; requer Bearer interno. */
products.get("/document-files/:id/stream", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const db = createDb(config.db);
    const storage = new R2StorageProvider(config.r2);
    const mediaService = createProductMediaService(db, storage);
    const { body, contentType } = await mediaService.streamByFileId(c.req.param("id"));

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id/detail", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.getOperationalDetail(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id/audit", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.listAuditLogsForProduct(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id/cost-snapshots", async (c) => {
  try {
    const url = new URL(c.req.url);
    const source = url.searchParams.get("source")?.trim() || undefined;
    const from = url.searchParams.get("from")?.trim() || undefined;
    const to = url.searchParams.get("to")?.trim() || undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductCostSnapshotService(db);
    const data = await service.listByProduct({
      productId: c.req.param("id"),
      source,
      from,
      to,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return c.json({
      data: data.items,
      meta: {
        total: data.total,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 50,
      },
    });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/recalculate-cost", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductCostSnapshotService(db);
    const data = await service.createFromCurrentBom(c.req.param("id"), "pricing_review", {
      trigger: "manual_recalculate",
    });
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id/compositions", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const compositionService = createProductCompositionService(db);
    const data = await compositionService.listByParent(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/compositions", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createProductCompositionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const compositionService = createProductCompositionService(db);
    const data = await compositionService.add(c.req.param("id"), parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.patch("/:id/compositions/:compositionId", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProductCompositionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const compositionService = createProductCompositionService(db);
    const data = await compositionService.update(
      c.req.param("id"),
      c.req.param("compositionId"),
      parsed.data,
    );
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.delete("/:id/compositions/:compositionId", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const compositionService = createProductCompositionService(db);
    await compositionService.archive(c.req.param("id"), c.req.param("compositionId"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id/variants", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.listVariants(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.patch("/:id/variants/:variantId", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProductVariantSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.updateVariant(
      c.req.param("id"),
      c.req.param("variantId"),
      parsed.data,
    );
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/variants/:variantId/archive", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    await service.archiveVariant(c.req.param("id"), c.req.param("variantId"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/variants/:variantId/restore", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    await service.restoreVariant(c.req.param("id"), c.req.param("variantId"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.get("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.findById(c.req.param("id"));
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.update(c.req.param("id"), parsed.data);
    return c.json({ data });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/restore", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    await service.restoreProduct(c.req.param("id"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

/** Eliminação permanente (BD + R2). `DELETE /products/:id` continua a ser apenas arquivar. */
products.post("/:id/permanent-delete", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = permanentDeleteProductSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const storage = new R2StorageProvider(config.r2);
    const result = await service.permanentDelete(c.req.param("id"), parsed.data, storage);
    return c.json({ success: true, deletedFileCount: result.deletedFileCount });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.delete("/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    await service.archive(c.req.param("id"));
    return c.json({ success: true });
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

products.post("/:id/variants", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createVariantSchema.safeParse({ ...body, productId: c.req.param("id") });
  if (!parsed.success)
    return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
  try {
    const config = getEnv(c.env);
    const db = createDb(config.db);
    const service = createProductService(db);
    const data = await service.createVariant(parsed.data);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { products };
