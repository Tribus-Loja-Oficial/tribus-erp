import { z } from "zod";
import type { ZodIssue } from "zod";
import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { createProductService } from "./product.service.js";
import { createProductMediaService } from "./product-media.service.js";
import { createPartyService } from "./party.service.js";
import { createInventoryService } from "./inventory.service.js";
import { createProductCompositionService } from "./product-composition.service.js";
import { createOrderService } from "./order.service.js";
import { createPurchaseService } from "./purchase.service.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductVariantRepository } from "../repositories/product-variant.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import { createProductCostSnapshotRepository } from "../repositories/product-cost-snapshot.repository.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { ValidationError } from "../errors/app-error.js";
import { logger } from "../observability/logger.js";
import { createProductSchema, type CreateProductInput } from "../schemas/product.schemas.js";
import type { CreateVariantInput } from "../schemas/product.schemas.js";
import type { CreateProductCompositionInput } from "../schemas/product.schemas.js";
import type { CreateOrderInput } from "../schemas/order.schemas.js";
import type { CreatePurchaseOrderInput } from "../schemas/purchase.schemas.js";
import type { StockMovementType } from "@tribus-erp/core";
import type {
  IngestionPayload,
  IngestionObject,
  IngestionObjectType,
  ProductIngestionData,
} from "../schemas/ingestion.schemas.js";
import { INGESTION_TYPE_ORDER } from "../schemas/ingestion.schemas.js";

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
  /** created: novo registo inserido. updated: registo existente actualizado (upsert). skipped: já existia, ignorado. failed: erro. */
  status: "created" | "updated" | "skipped" | "failed";
  id?: string;
  error?: string;
  warnings?: string[];
};

export type IngestionResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: IngestionItemResult[];
  refMap: Record<string, string>;
};

/** Estado persistido entre mensagens da fila (ingestão por chunks). */
export type IngestionChunkState = {
  cursor: number;
  refMap: Record<string, string>;
  items: IngestionItemResult[];
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  pendingImageTasks?: DeferredImageTask[];
};

export type DeferredImageTask = {
  productId: string;
  mainImageUrl?: string;
  galleryImageUrls: string[];
};

export type DryRunItemResult = {
  index: number;
  type: IngestionObjectType;
  clientRef?: string;
  plannedStatus: "created" | "updated" | "skipped" | "failed";
  detail?: string;
};

export type DryRunIngestionResult = {
  dryRun: true;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: ValidationResult["summary"];
  planned: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  items: DryRunItemResult[];
  refMap: Record<string, string>;
};

function sortByDependency(objects: IngestionObject[]): IngestionObject[] {
  return [...objects].sort((a, b) => INGESTION_TYPE_ORDER[a.type] - INGESTION_TYPE_ORDER[b.type]);
}

/**
 * O modelo de composição BOM não permite duas linhas activas com o mesmo
 * parent+child. Quando o payload traz linhas repetidas para o mesmo par,
 * consolidamos antes de executar para evitar UNIQUE no D1.
 */
function normalizeIngestionPayload(payload: IngestionPayload): IngestionPayload {
  const out: IngestionObject[] = [];
  type CompositionObject = Extract<IngestionObject, { type: "product_composition" }>;
  const byCompKey = new Map<string, CompositionObject>();

  for (const obj of payload.objects) {
    if (obj.type !== "product_composition") {
      out.push(obj);
      continue;
    }

    const key = [
      obj.data.parentProductRef,
      obj.data.childProductRef ?? "",
      obj.data.childSku ?? "",
      obj.data.compositionType,
      obj.data.packagingChannel ?? "",
    ].join("::");

    const prev = byCompKey.get(key);
    if (!prev) {
      byCompKey.set(key, obj);
      out.push(obj);
      continue;
    }

    // Soma deterministicamente a quantidade para o mesmo parent+child.
    prev.data.quantity += obj.data.quantity;
    if (obj.data.notes?.trim()) {
      const base = prev.data.notes?.trim();
      prev.data.notes = base ? `${base}\n${obj.data.notes}` : obj.data.notes;
    }
  }

  return { ...payload, objects: out };
}

function stripProductIngestionUrls(
  data: ProductIngestionData,
): Omit<
  ProductIngestionData,
  "main_image_url" | "gallery_image_urls" | "categoryRef" | "collectionRef"
> {
  const {
    main_image_url: _m,
    gallery_image_urls: _g,
    categoryRef: _cr,
    collectionRef: _colr,
    ...rest
  } = data;
  return rest;
}

function toCreateProductInput(
  data: ProductIngestionData,
  refMap: Record<string, string>,
): CreateProductInput {
  const stripped = stripProductIngestionUrls(data);
  const categoryId = data.categoryRef
    ? (refMap[data.categoryRef] ?? stripped.categoryId)
    : stripped.categoryId;
  const collectionId = data.collectionRef
    ? (refMap[data.collectionRef] ?? stripped.collectionId)
    : stripped.collectionId;
  if (data.categoryRef && !refMap[data.categoryRef] && !stripped.categoryId) {
    throw new Error(`categoryRef "${data.categoryRef}" ainda não resolvido.`);
  }
  if (data.collectionRef && !refMap[data.collectionRef] && !stripped.collectionId) {
    throw new Error(`collectionRef "${data.collectionRef}" ainda não resolvido.`);
  }
  return createProductSchema.parse({
    ...stripped,
    categoryId,
    collectionId,
  });
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

function expectRef(
  clientRefs: Map<string, { index: number; type: IngestionObjectType }>,
  ref: string | undefined,
  expectedType: IngestionObjectType,
  ctx: { objectIndex: number; objectType: IngestionObjectType; clientRef?: string },
  field: string,
  errors: ValidationIssue[],
) {
  if (!ref?.trim()) return;
  const target = clientRefs.get(ref);
  if (!target) {
    errors.push({
      ...ctx,
      field,
      message: `${field} "${ref}" não corresponde a nenhum client_ref neste payload.`,
    });
    return;
  }
  if (target.type !== expectedType) {
    errors.push({
      ...ctx,
      field,
      message: `${field} "${ref}" aponta para tipo "${target.type}", esperado "${expectedType}".`,
    });
  }
}

/** Resumo por tipo (audit) sem validação semântica — uso em continuações chunked. */
export function ingestionPayloadSummaryOnly(
  payload: IngestionPayload,
): ValidationResult["summary"] {
  const byType: Record<string, number> = {};
  for (const o of payload.objects) {
    byType[o.type] = (byType[o.type] ?? 0) + 1;
  }
  return { total: payload.objects.length, byType };
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
          message: `client_ref "${obj.client_ref}" duplicado.`,
        });
      } else {
        clientRefs.set(obj.client_ref, { index: i, type: obj.type });
      }
    }
  });

  objects.forEach((obj, i) => {
    const ctx = { objectIndex: i, objectType: obj.type, clientRef: obj.client_ref };

    switch (obj.type) {
      case "category":
        expectRef(
          clientRefs,
          obj.data.parentCategoryRef,
          "category",
          ctx,
          "data.parentCategoryRef",
          errors,
        );
        break;
      case "product":
        expectRef(clientRefs, obj.data.categoryRef, "category", ctx, "data.categoryRef", errors);
        expectRef(
          clientRefs,
          obj.data.collectionRef,
          "collection",
          ctx,
          "data.collectionRef",
          errors,
        );
        break;
      case "product_variant":
        expectRef(clientRefs, obj.data.productRef, "product", ctx, "data.productRef", errors);
        break;
      case "product_composition":
        expectRef(
          clientRefs,
          obj.data.parentProductRef,
          "product",
          ctx,
          "data.parentProductRef",
          errors,
        );
        if (obj.data.childProductRef) {
          expectRef(
            clientRefs,
            obj.data.childProductRef,
            "product",
            ctx,
            "data.childProductRef",
            errors,
          );
        }
        break;
      case "inventory_movement": {
        const d = obj.data;
        if (d.productRef)
          expectRef(clientRefs, d.productRef, "product", ctx, "data.productRef", errors);
        if (d.locationRef)
          expectRef(clientRefs, d.locationRef, "stock_location", ctx, "data.locationRef", errors);
        if (!d.productId && !d.productRef) {
          errors.push({
            ...ctx,
            field: "data.productId",
            message: "Indique productId ou productRef.",
          });
        }
        if (!d.locationId && !d.locationRef) {
          errors.push({
            ...ctx,
            field: "data.locationId",
            message: "Indique locationId ou locationRef.",
          });
        }
        if (d.variantRef)
          expectRef(clientRefs, d.variantRef, "product_variant", ctx, "data.variantRef", errors);
        break;
      }
      case "order": {
        const d = obj.data;
        if (d.customerRef)
          expectRef(clientRefs, d.customerRef, "customer", ctx, "data.customerRef", errors);
        if (!d.customerId && !d.customerRef) {
          errors.push({
            ...ctx,
            field: "data.customerId",
            message: "Indique customerId ou customerRef.",
          });
        }
        d.items.forEach((it, j) => {
          if (it.productRef) {
            expectRef(
              clientRefs,
              it.productRef,
              "product",
              ctx,
              `data.items[${j}].productRef`,
              errors,
            );
          }
          if (it.variantRef) {
            expectRef(
              clientRefs,
              it.variantRef,
              "product_variant",
              ctx,
              `data.items[${j}].variantRef`,
              errors,
            );
          }
        });
        break;
      }
      case "purchase_order": {
        const d = obj.data;
        if (d.supplierRef)
          expectRef(clientRefs, d.supplierRef, "supplier", ctx, "data.supplierRef", errors);
        if (!d.supplierId && !d.supplierRef) {
          errors.push({
            ...ctx,
            field: "data.supplierId",
            message: "Indique supplierId ou supplierRef.",
          });
        }
        d.items.forEach((it, j) => {
          if (it.productRef) {
            expectRef(
              clientRefs,
              it.productRef,
              "product",
              ctx,
              `data.items[${j}].productRef`,
              errors,
            );
          }
        });
        break;
      }
      case "purchase_receipt": {
        const d = obj.data;
        if (d.supplierRef)
          expectRef(clientRefs, d.supplierRef, "supplier", ctx, "data.supplierRef", errors);
        if (!d.supplierId && !d.supplierRef) {
          warnings.push({
            ...ctx,
            field: "data.supplierId",
            message: "Compra sem fornecedor definido.",
          });
        }
        if (d.purchaseOrderRef)
          expectRef(
            clientRefs,
            d.purchaseOrderRef,
            "purchase_order",
            ctx,
            "data.purchaseOrderRef",
            errors,
          );
        if (d.locationRef)
          expectRef(clientRefs, d.locationRef, "stock_location", ctx, "data.locationRef", errors);
        d.items.forEach((it, j) => {
          if (it.purchasedQuantity <= 0 || it.stockQuantity <= 0) {
            errors.push({
              ...ctx,
              field: `data.items[${j}]`,
              message: "purchasedQuantity e stockQuantity devem ser > 0.",
            });
          }
          const expectedTotal =
            it.grossAmountCents -
            it.discountAmountCents +
            it.freightAmountCents +
            it.taxAmountCents +
            it.otherCostAmountCents;
          if (it.totalCostCents !== undefined && it.totalCostCents !== expectedTotal) {
            warnings.push({
              ...ctx,
              field: `data.items[${j}].totalCostCents`,
              message:
                "totalCostCents difere do cálculo gross-discount+freight+tax+other; será usado o valor informado.",
            });
          }
          if ((it.totalCostCents ?? expectedTotal) / it.stockQuantity < 0.01) {
            warnings.push({
              ...ctx,
              field: `data.items[${j}].stockQuantity`,
              message: "Custo unitário muito pequeno; valide arredondamento.",
            });
          }
          if (it.productRef) {
            expectRef(
              clientRefs,
              it.productRef,
              "product",
              ctx,
              `data.items[${j}].productRef`,
              errors,
            );
          }
        });
        break;
      }
      case "product_cost_snapshot":
        if (obj.data.productRef) {
          expectRef(clientRefs, obj.data.productRef, "product", ctx, "data.productRef", errors);
        }
        break;
      default:
        break;
    }
  });

  const productKindByRef = new Map<string, "simple" | "variable">();
  for (const obj of objects) {
    if (obj.type === "product" && obj.client_ref) {
      productKindByRef.set(
        obj.client_ref,
        obj.data.productKind === "variable" ? "variable" : "simple",
      );
    }
  }

  objects.forEach((obj, i) => {
    const ctx = { objectIndex: i, objectType: obj.type, clientRef: obj.client_ref };
    if (obj.type === "product_variant") {
      const pref = obj.data.productRef;
      if (pref && productKindByRef.has(pref) && productKindByRef.get(pref) !== "variable") {
        errors.push({
          ...ctx,
          field: "data.productRef",
          message: `O produto "${pref}" está como simples neste payload. Variações exigem "productKind": "variable" no objecto product com esse client_ref.`,
        });
      }
    }
    if (obj.type === "inventory_movement") {
      const d = obj.data;
      const pref = d.productRef;
      if (pref && productKindByRef.has(pref) && productKindByRef.get(pref) === "variable") {
        const hasVariant = Boolean(d.variantId?.trim()) || Boolean(d.variantRef?.trim());
        if (!hasVariant) {
          errors.push({
            ...ctx,
            field: "data.variantId",
            message: `Produto variável (${pref}): indique variantId ou variantRef (client_ref da variação no mesmo payload).`,
          });
        }
      }
    }
    if (obj.type === "order") {
      obj.data.items.forEach((it, j) => {
        const pref = it.productRef;
        if (pref && productKindByRef.has(pref) && productKindByRef.get(pref) === "variable") {
          const hasVariant = Boolean(it.variantId?.trim()) || Boolean(it.variantRef?.trim());
          if (!hasVariant) {
            errors.push({
              ...ctx,
              field: `data.items[${j}].variantId`,
              message: `Produto variável (${pref}) na linha ${j + 1}: indique variantId ou variantRef.`,
            });
          }
        }
      });
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

type IngestionCtx = {
  productService: ReturnType<typeof createProductService>;
  partyService: ReturnType<typeof createPartyService>;
  inventoryService: ReturnType<typeof createInventoryService>;
  compositionService: ReturnType<typeof createProductCompositionService>;
  orderService: ReturnType<typeof createOrderService>;
  purchaseService: ReturnType<typeof createPurchaseService>;
  productsRepo: ReturnType<typeof createProductRepository>;
  variantsRepo: ReturnType<typeof createProductVariantRepository>;
  productCostSnapshotRepo: ReturnType<typeof createProductCostSnapshotRepository>;
  media: ReturnType<typeof createProductMediaService> | null;
};

/** Processa objectos sortedObjects[start..end) (índices por ordem de dependência). */
async function processIngestionSlice(
  sortedObjects: IngestionObject[],
  start: number,
  end: number,
  ctx: IngestionCtx,
  refMap: Record<string, string>,
  items: IngestionItemResult[],
  counts: { created: number; updated: number; skipped: number; failed: number },
  originalIndexMap: Map<IngestionObject, number>,
  execOpts: IngestionObjectExecOpts,
  afterEachObject?: (sortedProcessedCount: number) => void | Promise<void>,
): Promise<void> {
  for (let idx = start; idx < end; idx++) {
    const obj = sortedObjects[idx]!;
    const originalIndex = originalIndexMap.get(obj) ?? -1;
    const itemBase: Omit<IngestionItemResult, "status" | "id" | "error" | "warnings"> = {
      index: originalIndex,
      type: obj.type,
      clientRef: obj.client_ref,
    };

    try {
      const { id, outcome, warnings } = await createIngestionObject(obj, ctx, refMap, execOpts);
      if (obj.client_ref) refMap[obj.client_ref] = id;
      items.push({
        ...itemBase,
        status: outcome,
        id,
        warnings: warnings.length ? warnings : undefined,
      });
      if (outcome === "created") counts.created++;
      else if (outcome === "updated") counts.updated++;
      else counts.skipped++;
    } catch (err) {
      let message = err instanceof Error ? err.message : "Erro desconhecido";
      const cause = err instanceof Error ? err.cause : undefined;
      if (cause instanceof Error && cause.message) {
        message += ` | ${cause.message}`;
      }
      items.push({ ...itemBase, status: "failed", error: message });
      counts.failed++;
    }

    await afterEachObject?.(idx + 1);
  }
}

function slugifyForDryRun(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type DryRunPredict = { status: DryRunItemResult["plannedStatus"]; id?: string; detail?: string };

function dryRunSyntheticId(clientRef?: string, sku?: string, index?: number): string {
  if (clientRef) return `dry-run:ref:${clientRef}`;
  if (sku) return `dry-run:sku:${sku}`;
  return `dry-run:idx:${index ?? 0}`;
}

async function resolveChildProductIdDryRun(
  ctx: IngestionCtx,
  refMap: Record<string, string>,
  skuToId: Map<string, string>,
  childProductRef?: string,
  childSku?: string,
): Promise<{ id: string } | { error: string }> {
  if (childProductRef) {
    const id = refMap[childProductRef];
    if (!id) return { error: `childProductRef "${childProductRef}" não resolvido no simulador.` };
    return { id };
  }
  if (childSku) {
    const fromBatch = skuToId.get(childSku);
    if (fromBatch) return { id: fromBatch };
    const row = await ctx.productsRepo.findBySku(childSku);
    if (row) return { id: row.id };
    return {
      error: `childSku "${childSku}" não encontrado na base nem criado antes neste payload.`,
    };
  }
  return { error: "childProductRef ou childSku é obrigatório." };
}

async function predictDryRunObject(
  obj: IngestionObject,
  ctx: IngestionCtx,
  refMap: Record<string, string>,
  skuToId: Map<string, string>,
  objectIndex: number,
): Promise<DryRunPredict> {
  switch (obj.type) {
    case "stock_location": {
      const id = obj.client_ref
        ? dryRunSyntheticId(obj.client_ref)
        : dryRunSyntheticId(undefined, undefined, objectIndex);
      return { status: "created", id: obj.client_ref ? id : undefined };
    }
    case "category": {
      const slug = obj.data.slug;
      const existing = await ctx.productsRepo.findCategoryBySlug(slug);
      if (obj.action === "upsert") {
        if (existing) return { status: "updated", id: existing.id };
        if (!obj.data.name) {
          return {
            status: "failed",
            detail: `Categoria "${slug}" não existe e falta "name" para criar.`,
          };
        }
        return {
          status: "created",
          id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
        };
      }
      if (existing) return { status: "skipped", id: existing.id };
      return { status: "created", id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex) };
    }
    case "collection": {
      const slug = obj.data.slug;
      const existing = await ctx.productsRepo.findCollectionBySlug(slug);
      if (obj.action === "upsert") {
        if (existing) return { status: "updated", id: existing.id };
        if (!obj.data.name) {
          return {
            status: "failed",
            detail: `Coleção "${slug}" não existe e falta "name" para criar.`,
          };
        }
        return {
          status: "created",
          id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
        };
      }
      if (existing) return { status: "skipped", id: existing.id };
      return { status: "created", id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex) };
    }
    case "party":
    case "customer":
    case "supplier":
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
      };
    case "product": {
      try {
        if (obj.action === "upsert") {
          const identifier = obj.data.slug ?? obj.data.sku;
          if (!identifier) {
            return { status: "failed", detail: "Em upsert de produto indique slug ou sku." };
          }
          const existing = await ctx.productsRepo.findBySlugOrSku(identifier);
          if (existing) return { status: "updated", id: existing.id };
          if (!obj.data.name || !obj.data.productType) {
            return {
              status: "failed",
              detail: `Produto "${identifier}" não existe; são necessários name e productType para criar.`,
            };
          }
          const input = toCreateProductInput(
            obj.data as Parameters<typeof toCreateProductInput>[0],
            refMap,
          );
          const skuHit = await ctx.productsRepo.findBySku(input.sku);
          if (skuHit) {
            return {
              status: "failed",
              detail: `SKU '${input.sku}' já existe na base.`,
            };
          }
          const varSkuHit = await ctx.variantsRepo.findBySku(input.sku);
          if (varSkuHit) {
            return {
              status: "failed",
              detail: `SKU '${input.sku}' já existe numa variação.`,
            };
          }
          const effSlug = input.slug ? slugifyForDryRun(input.slug) : slugifyForDryRun(input.name);
          const slugHit = await ctx.productsRepo.findBySlugOrSku(effSlug);
          if (slugHit) {
            return {
              status: "failed",
              detail: `Slug '${effSlug}' já está em uso.`,
            };
          }
          return {
            status: "created",
            id: dryRunSyntheticId(obj.client_ref, input.sku, objectIndex),
          };
        }

        const data = obj.data as Parameters<typeof toCreateProductInput>[0];
        const input = toCreateProductInput(data, refMap);
        const skuHit = await ctx.productsRepo.findBySku(input.sku);
        if (skuHit) {
          return { status: "failed", detail: `SKU '${input.sku}' already exists` };
        }
        const varSkuHit = await ctx.variantsRepo.findBySku(input.sku);
        if (varSkuHit) {
          return {
            status: "failed",
            detail: `SKU '${input.sku}' já existe numa variação.`,
          };
        }
        const effSlug = input.slug ? slugifyForDryRun(input.slug) : slugifyForDryRun(input.name);
        const slugHit = await ctx.productsRepo.findBySlugOrSku(effSlug);
        if (slugHit) {
          return { status: "failed", detail: `Slug '${effSlug}' já está em uso.` };
        }
        return {
          status: "created",
          id: dryRunSyntheticId(obj.client_ref, input.sku, objectIndex),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao simular produto.";
        return { status: "failed", detail: msg };
      }
    }
    case "product_variant": {
      const productId = refMap[obj.data.productRef];
      if (!productId) {
        return {
          status: "failed",
          detail: `productRef "${obj.data.productRef}" não resolvido.`,
        };
      }
      const skuHit = await ctx.productsRepo.findBySku(obj.data.sku);
      if (skuHit) {
        return { status: "failed", detail: `SKU '${obj.data.sku}' already exists` };
      }
      const varSkuHit = await ctx.variantsRepo.findBySku(obj.data.sku);
      if (varSkuHit) {
        return {
          status: "failed",
          detail: `SKU '${obj.data.sku}' já existe numa variação.`,
        };
      }
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, obj.data.sku, objectIndex),
      };
    }
    case "product_composition": {
      const parentId = refMap[obj.data.parentProductRef];
      if (!parentId) {
        return {
          status: "failed",
          detail: `parentProductRef "${obj.data.parentProductRef}" não resolvido.`,
        };
      }
      const child = await resolveChildProductIdDryRun(
        ctx,
        refMap,
        skuToId,
        obj.data.childProductRef,
        obj.data.childSku,
      );
      if ("error" in child) return { status: "failed", detail: child.error };
      void parentId;
      void child.id;
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
      };
    }
    case "inventory_movement": {
      const productId = obj.data.productId ?? refMap[obj.data.productRef!];
      const locationId = obj.data.locationId ?? refMap[obj.data.locationRef!];
      if (!productId) {
        return { status: "failed", detail: "productId/productRef em falta ou não resolvido." };
      }
      if (!locationId) {
        return { status: "failed", detail: "locationId/locationRef em falta ou não resolvido." };
      }
      const variantId =
        obj.data.variantId?.trim() ||
        (obj.data.variantRef ? refMap[obj.data.variantRef] : undefined);
      if (obj.data.variantRef?.trim() && !variantId) {
        return {
          status: "failed",
          detail: `variantRef "${obj.data.variantRef}" não resolvido.`,
        };
      }
      void productId;
      void locationId;
      void variantId;
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
      };
    }
    case "order": {
      const customerId = obj.data.customerId ?? refMap[obj.data.customerRef!];
      if (!customerId) {
        return { status: "failed", detail: "customerId/customerRef em falta ou não resolvido." };
      }
      try {
        obj.data.items.forEach((it, j) => {
          const variantId =
            it.variantId?.trim() || (it.variantRef ? refMap[it.variantRef] : undefined);
          if (it.variantRef?.trim() && !variantId) {
            throw new Error(`variantRef "${it.variantRef}" não resolvido (items[${j}]).`);
          }
          const productId = it.productId ?? (it.productRef ? refMap[it.productRef] : undefined);
          void productId;
          void variantId;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro nas linhas do pedido.";
        return { status: "failed", detail: msg };
      }
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
      };
    }
    case "purchase_order": {
      const supplierId = obj.data.supplierId ?? refMap[obj.data.supplierRef!];
      if (!supplierId) {
        return { status: "failed", detail: "supplierId/supplierRef em falta ou não resolvido." };
      }
      void supplierId;
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
      };
    }
    case "purchase_receipt": {
      const locationId =
        obj.data.locationId ?? (obj.data.locationRef ? refMap[obj.data.locationRef] : undefined);
      if (!locationId) {
        return { status: "failed", detail: "locationId/locationRef em falta ou não resolvido." };
      }
      if (!obj.data.supplierId && !obj.data.supplierRef) {
        return {
          status: "created",
          id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
          detail: "Warning: compra sem fornecedor definido.",
        };
      }
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
      };
    }
    case "product_cost_snapshot": {
      const productId =
        obj.data.productId ?? (obj.data.productRef ? refMap[obj.data.productRef] : undefined);
      if (!productId) {
        return { status: "failed", detail: "productId/productRef em falta ou não resolvido." };
      }
      const n = obj.data.componentCosts?.length ?? 0;
      return {
        status: "created",
        id: dryRunSyntheticId(obj.client_ref, undefined, objectIndex),
        detail:
          n > 0
            ? `Snapshot com ${n} linha(s) em componentCosts (gravadas em component_costs_json).`
            : undefined,
      };
    }
  }
}

/** Paralelismo por produto para reduzir wall-clock em lotes com muitas URLs de galeria. */
const GALLERY_IMAGE_FETCH_CONCURRENCY = 5;

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

  const galleryUrls = data.gallery_image_urls ?? [];
  for (let start = 0; start < galleryUrls.length; start += GALLERY_IMAGE_FETCH_CONCURRENCY) {
    const slice = galleryUrls.slice(start, start + GALLERY_IMAGE_FETCH_CONCURRENCY);
    const sliceResults = await Promise.all(
      slice.map(async (url, j) => {
        const displayIndex = start + j + 1;
        try {
          const doc = await media.uploadProductImageFromUrl({ url, productId });
          return { ok: true as const, id: doc.id };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro desconhecido";
          return { ok: false as const, displayIndex, msg };
        }
      }),
    );
    for (const r of sliceResults) {
      if (r.ok) galleryIds.push(r.id);
      else warnings.push(`Galeria URL #${r.displayIndex}: ${r.msg}`);
    }
  }

  if (galleryUrls.length) {
    await productService.update(productId, { imagesJson: galleryIds });
  }

  return warnings;
}

async function resolveChildProductIdWithBatch(
  ctx: IngestionCtx,
  refMap: Record<string, string>,
  childProductRef?: string,
  childSku?: string,
): Promise<string> {
  if (childProductRef) {
    const id = refMap[childProductRef];
    if (!id) throw new Error(`childProductRef "${childProductRef}" não resolvido.`);
    return id;
  }
  if (childSku) {
    const row = await ctx.productsRepo.findBySku(childSku);
    if (row) return row.id;
    throw new Error(`childSku "${childSku}" não encontrado.`);
  }
  throw new Error("childProductRef ou childSku é obrigatório.");
}

type IngestionObjectExecOpts = {
  skipProductImageUrls?: boolean;
  /** Orçamento de URLs de imagem por execução (main + galeria), usado no async chunked. */
  imageUrlBudgetRemaining?: number;
  imageUrlBudgetMax?: number;
  onDeferImageTask?: (task: DeferredImageTask) => void;
};

function countImageUrlsInProductData(data: ProductIngestionData): number {
  return (data.main_image_url ? 1 : 0) + (data.gallery_image_urls?.length ?? 0);
}

async function createIngestionObject(
  obj: IngestionObject,
  ctx: IngestionCtx,
  refMap: Record<string, string>,
  execOpts: IngestionObjectExecOpts,
): Promise<{ id: string; outcome: "created" | "updated" | "skipped"; warnings: string[] }> {
  const warnings: string[] = [];

  switch (obj.type) {
    case "stock_location": {
      const row = await ctx.inventoryService.createLocation(obj.data);
      return { id: row.id, outcome: "created", warnings };
    }
    case "category": {
      const parentId = obj.data.parentCategoryRef
        ? refMap[obj.data.parentCategoryRef]
        : obj.data.parentId;
      if (obj.data.parentCategoryRef && !parentId) {
        throw new Error(`parentCategoryRef "${obj.data.parentCategoryRef}" não resolvido.`);
      }
      const ts = new Date().toISOString();

      if (obj.action === "upsert") {
        const updated = await ctx.productsRepo.upsertCategoryBySlug(obj.data.slug, {
          name: obj.data.name,
          description: obj.data.description ?? null,
          parentId: parentId ?? null,
        });
        if (updated) return { id: updated.id, outcome: "updated", warnings };
        // Não existe → criar (requer name; valida Zod já garantiu slug)
        if (!obj.data.name)
          throw new Error(`Categoria "${obj.data.slug}" não encontrada e name ausente para criar.`);
      }

      const { row, skipped } = await ctx.productsRepo.insertCategoryIdempotent({
        id: generateId(),
        name: obj.data.name!,
        slug: obj.data.slug,
        parentId: parentId ?? null,
        description: obj.data.description ?? null,
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      });
      return { id: row.id, outcome: skipped ? "skipped" : "created", warnings };
    }
    case "collection": {
      const ts = new Date().toISOString();

      if (obj.action === "upsert") {
        const updated = await ctx.productsRepo.upsertCollectionBySlug(obj.data.slug, {
          name: obj.data.name,
          description: obj.data.description ?? null,
          niche: obj.data.niche ?? null,
          season: obj.data.season ?? null,
          status: obj.data.status,
        });
        if (updated) return { id: updated.id, outcome: "updated", warnings };
        if (!obj.data.name)
          throw new Error(`Coleção "${obj.data.slug}" não encontrada e name ausente para criar.`);
      }

      const { row, skipped } = await ctx.productsRepo.insertCollectionIdempotent({
        id: generateId(),
        name: obj.data.name!,
        slug: obj.data.slug,
        description: obj.data.description ?? null,
        niche: obj.data.niche ?? null,
        season: obj.data.season ?? null,
        status: obj.data.status ?? "active",
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null,
      });
      return { id: row.id, outcome: skipped ? "skipped" : "created", warnings };
    }
    case "party": {
      const row = await ctx.partyService.create(obj.data);
      return { id: row.id, outcome: "created", warnings };
    }
    case "customer": {
      const { customer } = await ctx.partyService.createCustomerWithParty(obj.data);
      return { id: customer.id, outcome: "created", warnings };
    }
    case "supplier": {
      const { supplier } = await ctx.partyService.createSupplierWithParty(obj.data);
      return { id: supplier.id, outcome: "created", warnings };
    }
    case "product": {
      if (obj.action === "upsert") {
        const identifier = obj.data.slug ?? obj.data.sku;
        if (!identifier)
          throw new Error("Em upsert de produto forneça slug ou sku para identificar o registo.");
        const categoryId =
          (obj.data.categoryRef ? refMap[obj.data.categoryRef] : undefined) ?? obj.data.categoryId;
        const collectionId =
          (obj.data.collectionRef ? refMap[obj.data.collectionRef] : undefined) ??
          obj.data.collectionId;
        const {
          categoryRef: _cr,
          collectionRef: _colr,
          main_image_url: _mi,
          gallery_image_urls: _gi,
          status: _st,
          productType: _pt,
          imagesJson: _ij,
          ...patchRest
        } = obj.data;
        const patch: Parameters<typeof ctx.productsRepo.upsertProductBySlugOrSku>[1] = {
          ...patchRest,
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(collectionId !== undefined ? { collectionId } : {}),
          ...(_st !== undefined
            ? { status: _st as "draft" | "active" | "inactive" | "archived" }
            : {}),
          ...(_pt !== undefined
            ? {
                productType: _pt as
                  | "finished_product"
                  | "raw_material"
                  | "packaging"
                  | "kit"
                  | "bundle"
                  | "service"
                  | "consumable",
              }
            : {}),
        };
        const updated = await ctx.productsRepo.upsertProductBySlugOrSku(identifier, patch);
        if (updated) {
          const hasUrls = Boolean(obj.data.main_image_url || obj.data.gallery_image_urls?.length);
          const imageUrlCount = countImageUrlsInProductData(
            obj.data as Parameters<typeof countImageUrlsInProductData>[0],
          );
          const budgetExceeded =
            hasUrls &&
            execOpts.imageUrlBudgetRemaining !== undefined &&
            execOpts.imageUrlBudgetRemaining < imageUrlCount;
          if (hasUrls && execOpts.skipProductImageUrls) {
            warnings.push(
              "Imagens por URL omitidas (envelope skipProductImageUrls). Produto actualizado sem alterar imagens.",
            );
          } else if (budgetExceeded) {
            execOpts.onDeferImageTask?.({
              productId: updated.id,
              mainImageUrl: obj.data.main_image_url,
              galleryImageUrls: [...(obj.data.gallery_image_urls ?? [])],
            });
          } else if (hasUrls && ctx.media) {
            const w = await applyProductImagesFromUrls(
              ctx.media,
              ctx.productService,
              updated.id,
              obj.data as Parameters<typeof applyProductImagesFromUrls>[3],
            );
            warnings.push(...w);
            if (execOpts.imageUrlBudgetRemaining !== undefined) {
              execOpts.imageUrlBudgetRemaining = Math.max(
                0,
                execOpts.imageUrlBudgetRemaining - imageUrlCount,
              );
            }
          }
          return { id: updated.id, outcome: "updated", warnings };
        }
        // Não existe → criar (requer campos obrigatórios)
        if (!obj.data.name || !obj.data.productType)
          throw new Error(
            `Produto "${identifier}" não encontrado e name/productType ausentes para criar.`,
          );
      }

      const input = toCreateProductInput(
        obj.data as Parameters<typeof toCreateProductInput>[0],
        refMap,
      );
      const product = await ctx.productService.create(input);
      const hasUrls = Boolean(obj.data.main_image_url || obj.data.gallery_image_urls?.length);
      const imageUrlCount = countImageUrlsInProductData(
        obj.data as Parameters<typeof countImageUrlsInProductData>[0],
      );
      const budgetExceeded =
        hasUrls &&
        execOpts.imageUrlBudgetRemaining !== undefined &&
        execOpts.imageUrlBudgetRemaining < imageUrlCount;
      if (hasUrls && execOpts.skipProductImageUrls) {
        warnings.push(
          "Imagens por URL omitidas (envelope skipProductImageUrls). Produto criado sem imagens.",
        );
      } else if (budgetExceeded) {
        execOpts.onDeferImageTask?.({
          productId: product.id,
          mainImageUrl: obj.data.main_image_url,
          galleryImageUrls: [...(obj.data.gallery_image_urls ?? [])],
        });
      } else if (hasUrls && !ctx.media) {
        if (obj.data.main_image_url) warnings.push("Imagem principal (URL): R2 indisponível.");
        (obj.data.gallery_image_urls ?? []).forEach((_, i) =>
          warnings.push(`Galeria URL #${i + 1}: R2 indisponível.`),
        );
        return { id: product.id, outcome: "created", warnings };
      } else if (hasUrls && ctx.media) {
        const w = await applyProductImagesFromUrls(
          ctx.media,
          ctx.productService,
          product.id,
          obj.data as Parameters<typeof applyProductImagesFromUrls>[3],
        );
        warnings.push(...w);
        if (execOpts.imageUrlBudgetRemaining !== undefined) {
          execOpts.imageUrlBudgetRemaining = Math.max(
            0,
            execOpts.imageUrlBudgetRemaining - imageUrlCount,
          );
        }
      }
      return { id: product.id, outcome: "created", warnings };
    }
    case "product_variant": {
      const productId = refMap[obj.data.productRef];
      if (!productId) throw new Error(`productRef "${obj.data.productRef}" não resolvido.`);
      const { productRef: _pr, ...rest } = obj.data;
      const variantInput = { ...rest, productId } as CreateVariantInput;
      const v = await ctx.productService.createVariant(variantInput);
      return { id: v.id, outcome: "created", warnings };
    }
    case "product_composition": {
      const parentId = refMap[obj.data.parentProductRef];
      if (!parentId)
        throw new Error(`parentProductRef "${obj.data.parentProductRef}" não resolvido.`);
      const childProductId = await resolveChildProductIdWithBatch(
        ctx,
        refMap,
        obj.data.childProductRef,
        obj.data.childSku,
      );
      const { parentProductRef: _p, childProductRef: _c, childSku: _s, ...compRest } = obj.data;
      const payload: CreateProductCompositionInput = {
        ...compRest,
        childProductId,
      };
      const row = await ctx.compositionService.add(parentId, payload);
      return { id: row.id, outcome: "created", warnings };
    }
    case "inventory_movement": {
      const productId = obj.data.productId ?? refMap[obj.data.productRef!];
      const locationId = obj.data.locationId ?? refMap[obj.data.locationRef!];
      if (!productId) throw new Error("productId/productRef em falta.");
      if (!locationId) throw new Error("locationId/locationRef em falta.");
      const variantId =
        obj.data.variantId?.trim() ||
        (obj.data.variantRef ? refMap[obj.data.variantRef] : undefined);
      if (obj.data.variantRef?.trim() && !variantId) {
        throw new Error(`variantRef "${obj.data.variantRef}" não resolvido no refMap.`);
      }
      const movement = await ctx.inventoryService.addMovement({
        productId,
        variantId: variantId ?? undefined,
        locationId,
        type: obj.data.type as StockMovementType,
        quantity: obj.data.quantity,
        unitCostCents: obj.data.unitCostCents,
        referenceType: obj.data.referenceType,
        referenceId: obj.data.referenceId,
        notes: obj.data.notes,
      });
      return { id: movement.id, outcome: "created", warnings };
    }
    case "order": {
      const customerId = obj.data.customerId ?? refMap[obj.data.customerRef!];
      if (!customerId) throw new Error("customerId/customerRef em falta.");
      const items = obj.data.items.map((it, j) => {
        const variantId =
          it.variantId?.trim() || (it.variantRef ? refMap[it.variantRef] : undefined) || undefined;
        if (it.variantRef?.trim() && !variantId) {
          throw new Error(`variantRef "${it.variantRef}" não resolvido (items[${j}]).`);
        }
        return {
          productId: it.productId ?? (it.productRef ? refMap[it.productRef] : undefined),
          variantId,
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          discountCents: it.discountCents,
        };
      });
      const orderInput: CreateOrderInput = {
        channel: obj.data.channel,
        customerId,
        items,
        payments: obj.data.payments,
        discountTotalCents: obj.data.discountTotalCents,
        shippingTotalCents: obj.data.shippingTotalCents,
        notes: obj.data.notes,
      };
      const order = await ctx.orderService.create(orderInput);
      return { id: order.id, outcome: "created", warnings };
    }
    case "purchase_order": {
      const supplierId = obj.data.supplierId ?? refMap[obj.data.supplierRef!];
      if (!supplierId) throw new Error("supplierId/supplierRef em falta.");
      const items = obj.data.items.map((it) => ({
        productId: it.productId ?? (it.productRef ? refMap[it.productRef] : undefined),
        description: it.description,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
      }));
      const purchaseInput: CreatePurchaseOrderInput = {
        supplierId,
        issueDate: obj.data.issueDate,
        expectedDate: obj.data.expectedDate,
        freightAmountCents: obj.data.freightAmountCents,
        discountAmountCents: obj.data.discountAmountCents,
        taxAmountCents: obj.data.taxAmountCents,
        notes: obj.data.notes,
        items,
      };
      const po = await ctx.purchaseService.create(purchaseInput);
      return { id: po.id, outcome: "created" as const, warnings };
    }
    case "purchase_receipt": {
      const supplierId =
        obj.data.supplierId ?? (obj.data.supplierRef ? refMap[obj.data.supplierRef] : undefined);
      const purchaseOrderId =
        obj.data.purchaseOrderId ??
        (obj.data.purchaseOrderRef ? refMap[obj.data.purchaseOrderRef] : undefined);
      const locationId =
        obj.data.locationId ?? (obj.data.locationRef ? refMap[obj.data.locationRef] : undefined);
      if (!locationId) throw new Error("locationId/locationRef em falta.");
      const receipt = await ctx.purchaseService.createReceipt({
        externalRef: obj.data.externalRef,
        purchaseOrderId,
        supplierId,
        issueDate: obj.data.issueDate ?? obj.data.purchaseDate!,
        receivedAt: obj.data.receivedAt,
        documentNumber: obj.data.documentNumber,
        documentType: obj.data.documentType ?? "manual",
        sourceSystem: obj.data.sourceSystem,
        notes: obj.data.notes,
        metadata: obj.data.metadata,
        locationId,
        items: obj.data.items.map((it) => ({
          purchaseOrderItemId: it.purchaseOrderItemId,
          productId: it.productId ?? (it.productRef ? refMap[it.productRef] : undefined),
          description: it.description,
          purchasedQuantity: it.purchasedQuantity,
          purchaseUnit: it.purchaseUnit,
          stockQuantity: it.stockQuantity,
          stockUnit: it.stockUnit,
          grossAmountCents: it.grossAmountCents,
          discountAmountCents: it.discountAmountCents,
          freightAmountCents: it.freightAmountCents,
          taxAmountCents: it.taxAmountCents,
          otherCostAmountCents: it.otherCostAmountCents,
          totalCostCents: it.totalCostCents,
          notes: it.notes,
          metadata: it.metadata,
        })),
      });
      return { id: receipt.id, outcome: "created", warnings };
    }
    case "product_cost_snapshot": {
      const productId =
        obj.data.productId ?? (obj.data.productRef ? refMap[obj.data.productRef] : undefined);
      if (!productId) throw new Error("productId/productRef em falta.");
      const lines = obj.data.componentCosts;
      const componentCostsJson = lines && lines.length > 0 ? JSON.stringify(lines) : "[]";
      const snapshot = await ctx.productCostSnapshotRepo.insert({
        id: generateId(),
        productId,
        snapshotDate: obj.data.snapshotDate,
        source: obj.data.source,
        bomVersionId: obj.data.bomVersionId ?? null,
        materialCostCents: obj.data.materialCostCents,
        packagingCostCents: obj.data.packagingCostCents,
        laborCostCents: obj.data.laborCostCents,
        totalCostCents: obj.data.totalCostCents,
        componentCostsJson,
        metadataJson: JSON.stringify(obj.data.metadata ?? {}),
        createdAt: new Date().toISOString(),
      });
      return { id: snapshot.id, outcome: "created", warnings };
    }
    default: {
      const u: never = obj;
      throw new Error(`Tipo não suportado: ${String((u as IngestionObject).type)}`);
    }
  }
}

export function createIngestionService(db: AppDb, storage: StorageProvider | undefined) {
  const productService = createProductService(db);
  const partyService = createPartyService(db);
  const inventoryService = createInventoryService(db);
  const compositionService = createProductCompositionService(db);
  const orderService = createOrderService(db);
  const purchaseService = createPurchaseService(db);
  const productsRepo = createProductRepository(db);
  const variantsRepo = createProductVariantRepository(db);
  const productCostSnapshotRepo = createProductCostSnapshotRepository(db);
  const media = storage ? createProductMediaService(db, storage) : null;
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  const ctx: IngestionCtx = {
    productService,
    partyService,
    inventoryService,
    compositionService,
    orderService,
    purchaseService,
    productsRepo,
    variantsRepo,
    productCostSnapshotRepo,
    media,
  };

  return {
    validateIngestionPayload,

    async dryRunIngestion(payload: IngestionPayload): Promise<DryRunIngestionResult> {
      const normalizedPayload = normalizeIngestionPayload(payload);
      const validation = validateIngestionPayload(normalizedPayload);
      if (!validation.valid) {
        return {
          dryRun: true,
          valid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          summary: validation.summary,
          planned: { created: 0, updated: 0, skipped: 0, failed: 0 },
          items: [],
          refMap: {},
        };
      }

      const sortedObjects = sortByDependency(normalizedPayload.objects);
      const refMap: Record<string, string> = {};
      const skuToId = new Map<string, string>();
      const items: DryRunItemResult[] = [];
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      const originalIndexMap = new Map<IngestionObject, number>(
        normalizedPayload.objects.map((obj, i) => [obj, i]),
      );

      for (const obj of sortedObjects) {
        const originalIndex = originalIndexMap.get(obj) ?? -1;
        const pred = await predictDryRunObject(obj, ctx, refMap, skuToId, originalIndex);
        items.push({
          index: originalIndex,
          type: obj.type,
          clientRef: obj.client_ref,
          plannedStatus: pred.status,
          detail: pred.detail,
        });
        if (pred.status === "failed") {
          failed++;
          continue;
        }
        if (pred.status === "created") created++;
        else if (pred.status === "updated") updated++;
        else skipped++;

        if (obj.client_ref && pred.id) {
          refMap[obj.client_ref] = pred.id;
        }

        if (obj.type === "product" && pred.id) {
          let sku = obj.data.sku;
          if (!sku && !pred.id.startsWith("dry-run:")) {
            const row = await ctx.productsRepo.findById(pred.id);
            sku = row?.sku;
          }
          if (sku) skuToId.set(sku, pred.id);
        }
        if (obj.type === "product_variant" && pred.id && obj.data.sku) {
          skuToId.set(obj.data.sku, pred.id);
        }
      }

      items.sort((a, b) => a.index - b.index);

      return {
        dryRun: true,
        valid: true,
        errors: [],
        warnings: validation.warnings,
        summary: validation.summary,
        planned: { created, updated, skipped, failed },
        items,
        refMap,
      };
    },

    async executeIngestion(
      payload: IngestionPayload,
      options?: {
        actorId?: string | null;
        /** Chamado durante o processamento (ex.: jobs assíncronos); com throttle interno. */
        onProgress?: (p: { processed: number; total: number }) => void | Promise<void>;
      },
    ): Promise<IngestionResult> {
      const normalizedPayload = normalizeIngestionPayload(payload);
      const validation = validateIngestionPayload(normalizedPayload);
      if (!validation.valid) {
        throw new ValidationError(
          "Payload de ingestão inválido",
          semanticIssuesToZodIssues(validation.errors),
        );
      }

      const sortedObjects = sortByDependency(normalizedPayload.objects);
      const refMap: Record<string, string> = {};
      const items: IngestionItemResult[] = [];
      const execOpts: IngestionObjectExecOpts = {
        skipProductImageUrls: payload.skipProductImageUrls === true,
      };

      const originalIndexMap = new Map<IngestionObject, number>(
        normalizedPayload.objects.map((obj, i) => [obj, i]),
      );

      const totalObjects = sortedObjects.length;
      let processedCount = 0;
      let lastProgressEmitMs = 0;
      let lastProgressEmittedCount = 0;
      const PROGRESS_EMIT_MIN_MS = 500;
      const PROGRESS_EMIT_MIN_STEP = 25;

      const emitProgressIfNeeded = async () => {
        const onProgress = options?.onProgress;
        if (!onProgress) return;
        const now = Date.now();
        const isLast = processedCount >= totalObjects;
        const stepOk = processedCount - lastProgressEmittedCount >= PROGRESS_EMIT_MIN_STEP;
        const timeOk = now - lastProgressEmitMs >= PROGRESS_EMIT_MIN_MS;
        if (!isLast && !stepOk && !timeOk) return;
        lastProgressEmitMs = now;
        lastProgressEmittedCount = processedCount;
        await onProgress({ processed: processedCount, total: totalObjects });
      };

      const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
      await processIngestionSlice(
        sortedObjects,
        0,
        sortedObjects.length,
        ctx,
        refMap,
        items,
        counts,
        originalIndexMap,
        execOpts,
        async (sortedProcessedCount) => {
          processedCount = sortedProcessedCount;
          await emitProgressIfNeeded();
        },
      );

      const { created, updated, skipped, failed } = counts;

      items.sort((a, b) => a.index - b.index);

      try {
        await auditRepo.insert({
          id: generateId(),
          actorId: options?.actorId ?? null,
          actorType: "api",
          action: "ingestion.executed",
          entityType: "ingestion",
          entityId: "execute",
          metadataJson: JSON.stringify({
            total: normalizedPayload.objects.length,
            created,
            updated,
            skipped,
            failed,
            byType: validation.summary.byType,
            skipProductImageUrls: execOpts.skipProductImageUrls === true,
          }),
          createdAt: now(),
        });
      } catch (e) {
        logger.error("ingestion audit log failed after execute", {
          error: String(e),
          total: normalizedPayload.objects.length,
          created,
          failed,
        });
      }

      return {
        total: normalizedPayload.objects.length,
        created,
        updated,
        skipped,
        failed,
        items,
        refMap,
      };
    },

    /**
     * Um passo da ingestão assíncrona (fila): processa até `chunkSize` objectos na ordem de dependência,
     * persistindo estado entre invocações via `IngestionChunkState`.
     */
    async executeIngestionChunk(
      payload: IngestionPayload,
      state: IngestionChunkState | null,
      chunkSize: number,
      options?: {
        actorId?: string | null;
        onProgress?: (p: { processed: number; total: number }) => void | Promise<void>;
        /** Quando true, o payload já foi validado no 1.º chunk; poupa CPU nas mensagens seguintes. */
        assumePayloadSemanticallyValid?: boolean;
        /** Orçamento de URLs de imagens por execução de chunk (evita subrequests excessivos). */
        maxImageUrlsPerRun?: number;
      },
    ): Promise<
      | { done: true; result: IngestionResult }
      | { done: false; state: IngestionChunkState; processedSoFar: number; total: number }
    > {
      const normalizedPayload = normalizeIngestionPayload(payload);
      const validation = options?.assumePayloadSemanticallyValid
        ? ({
            valid: true,
            errors: [],
            warnings: [],
            summary: ingestionPayloadSummaryOnly(normalizedPayload),
          } satisfies ValidationResult)
        : validateIngestionPayload(normalizedPayload);
      if (!validation.valid) {
        throw new ValidationError(
          "Payload de ingestão inválido",
          semanticIssuesToZodIssues(validation.errors),
        );
      }

      const sortedObjects = sortByDependency(normalizedPayload.objects);
      const totalSorted = sortedObjects.length;
      const chunk = Math.max(1, Math.floor(chunkSize));

      const s: IngestionChunkState =
        state === null
          ? {
              cursor: 0,
              refMap: {},
              items: [],
              created: 0,
              updated: 0,
              skipped: 0,
              failed: 0,
              pendingImageTasks: [],
            }
          : {
              cursor: state.cursor,
              refMap: state.refMap,
              items: state.items,
              created: state.created,
              updated: state.updated,
              skipped: state.skipped,
              failed: state.failed,
              pendingImageTasks: state.pendingImageTasks ?? [],
            };

      const finish = async (): Promise<{ done: true; result: IngestionResult }> => {
        s.items.sort((a, b) => a.index - b.index);
        try {
          await auditRepo.insert({
            id: generateId(),
            actorId: options?.actorId ?? null,
            actorType: "api",
            action: "ingestion.executed",
            entityType: "ingestion",
            entityId: "execute",
            metadataJson: JSON.stringify({
              total: normalizedPayload.objects.length,
              created: s.created,
              updated: s.updated,
              skipped: s.skipped,
              failed: s.failed,
              byType: validation.summary.byType,
              skipProductImageUrls: payload.skipProductImageUrls === true,
              ingestionChunked: true,
            }),
            createdAt: now(),
          });
        } catch (e) {
          logger.error("ingestion audit log failed after chunked execute", {
            error: String(e),
            total: normalizedPayload.objects.length,
            created: s.created,
            failed: s.failed,
          });
        }
        return {
          done: true,
          result: {
            total: payload.objects.length,
            created: s.created,
            updated: s.updated,
            skipped: s.skipped,
            failed: s.failed,
            items: s.items,
            refMap: s.refMap,
          },
        };
      };

      if (s.cursor >= totalSorted) {
        return finish();
      }

      const endIdx = Math.min(s.cursor + chunk, totalSorted);
      const originalIndexMap = new Map<IngestionObject, number>(
        normalizedPayload.objects.map((obj, i) => [obj, i]),
      );
      const execOpts: IngestionObjectExecOpts = {
        skipProductImageUrls: payload.skipProductImageUrls === true,
        imageUrlBudgetRemaining:
          options?.maxImageUrlsPerRun !== undefined
            ? Math.max(0, Math.floor(options.maxImageUrlsPerRun))
            : undefined,
        imageUrlBudgetMax:
          options?.maxImageUrlsPerRun !== undefined
            ? Math.max(0, Math.floor(options.maxImageUrlsPerRun))
            : undefined,
        onDeferImageTask: (task) => {
          s.pendingImageTasks ??= [];
          s.pendingImageTasks.push(task);
        },
      };
      const counts = {
        created: s.created,
        updated: s.updated,
        skipped: s.skipped,
        failed: s.failed,
      };

      await processIngestionSlice(
        sortedObjects,
        s.cursor,
        endIdx,
        ctx,
        s.refMap,
        s.items,
        counts,
        originalIndexMap,
        execOpts,
      );

      s.cursor = endIdx;
      s.created = counts.created;
      s.updated = counts.updated;
      s.skipped = counts.skipped;
      s.failed = counts.failed;

      if (options?.onProgress) {
        await options.onProgress({ processed: endIdx, total: totalSorted });
      }

      const processDeferredImageTasks = async () => {
        const pending = s.pendingImageTasks ?? [];
        if (!ctx.media || pending.length === 0) return;
        let budget = execOpts.imageUrlBudgetRemaining;
        const maxPerRun = Math.max(
          1,
          execOpts.imageUrlBudgetMax ?? options?.maxImageUrlsPerRun ?? 1,
        );

        while (pending.length > 0) {
          const head = pending[0]!;
          const wantsMain = Boolean(head.mainImageUrl);
          const headCount = (wantsMain ? 1 : 0) + head.galleryImageUrls.length;
          if (budget !== undefined && budget <= 0) break;

          const allowed =
            budget === undefined ? headCount : Math.max(1, Math.min(maxPerRun, budget));
          let takeMain = false;
          let remain = allowed;
          if (wantsMain && remain > 0) {
            takeMain = true;
            remain -= 1;
          }
          const takeGallery = head.galleryImageUrls.slice(0, Math.max(0, remain));
          if (!takeMain && takeGallery.length === 0) break;

          const partial: ProductIngestionData = {
            ...(takeMain ? { main_image_url: head.mainImageUrl } : {}),
            ...(takeGallery.length > 0 ? { gallery_image_urls: takeGallery } : {}),
          } as ProductIngestionData;
          const w = await applyProductImagesFromUrls(
            ctx.media,
            ctx.productService,
            head.productId,
            partial,
          );
          if (w.length) {
            const item = [...s.items].reverse().find((it) => it.id === head.productId);
            if (item) item.warnings = [...(item.warnings ?? []), ...w];
          }

          if (takeMain) head.mainImageUrl = undefined;
          if (takeGallery.length > 0) {
            head.galleryImageUrls = head.galleryImageUrls.slice(takeGallery.length);
          }
          if (!head.mainImageUrl && head.galleryImageUrls.length === 0) {
            pending.shift();
          }
          if (budget !== undefined) {
            budget = Math.max(0, budget - (takeMain ? 1 : 0) - takeGallery.length);
          }
        }
        execOpts.imageUrlBudgetRemaining = budget;
      };
      await processDeferredImageTasks();

      if (endIdx >= totalSorted && (s.pendingImageTasks?.length ?? 0) === 0) {
        return finish();
      }

      return {
        done: false,
        state: s,
        processedSoFar: endIdx,
        total: totalSorted,
      };
    },
  };
}
