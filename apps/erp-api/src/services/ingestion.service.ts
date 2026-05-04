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
import { createAuditRepository } from "../repositories/audit.repository.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { ValidationError } from "../errors/app-error.js";
import { createProductSchema, type CreateProductInput } from "../schemas/product.schemas.js";
import type { CreateVariantInput } from "../schemas/product.schemas.js";
import type { CreateProductCompositionInput } from "../schemas/product.schemas.js";
import type { CreateOrderInput } from "../schemas/order.schemas.js";
import type { CreatePurchaseOrderInput } from "../schemas/purchase.schemas.js";
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

function sortByDependency(objects: IngestionObject[]): IngestionObject[] {
  return [...objects].sort((a, b) => INGESTION_TYPE_ORDER[a.type] - INGESTION_TYPE_ORDER[b.type]);
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
      default:
        break;
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
  media: ReturnType<typeof createProductMediaService> | null;
};

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

async function createIngestionObject(
  obj: IngestionObject,
  ctx: IngestionCtx,
  refMap: Record<string, string>,
): Promise<{ id: string; warnings: string[] }> {
  const warnings: string[] = [];

  switch (obj.type) {
    case "stock_location": {
      const row = await ctx.inventoryService.createLocation(obj.data);
      return { id: row.id, warnings };
    }
    case "category": {
      const parentId = obj.data.parentCategoryRef
        ? refMap[obj.data.parentCategoryRef]
        : obj.data.parentId;
      if (obj.data.parentCategoryRef && !parentId) {
        throw new Error(`parentCategoryRef "${obj.data.parentCategoryRef}" não resolvido.`);
      }
      const row = await ctx.productService.createCategory({
        name: obj.data.name,
        slug: obj.data.slug,
        parentId,
        description: obj.data.description,
      });
      return { id: row.id, warnings };
    }
    case "collection": {
      const row = await ctx.productService.createCollection(obj.data);
      return { id: row.id, warnings };
    }
    case "party": {
      const row = await ctx.partyService.create(obj.data);
      return { id: row.id, warnings };
    }
    case "customer": {
      const { customer } = await ctx.partyService.createCustomerWithParty(obj.data);
      return { id: customer.id, warnings };
    }
    case "supplier": {
      const { supplier } = await ctx.partyService.createSupplierWithParty(obj.data);
      return { id: supplier.id, warnings };
    }
    case "product": {
      const input = toCreateProductInput(obj.data, refMap);
      const product = await ctx.productService.create(input);
      const hasUrls = Boolean(obj.data.main_image_url || obj.data.gallery_image_urls?.length);
      if (hasUrls && !ctx.media) {
        if (obj.data.main_image_url) warnings.push("Imagem principal (URL): R2 indisponível.");
        (obj.data.gallery_image_urls ?? []).forEach((_, i) =>
          warnings.push(`Galeria URL #${i + 1}: R2 indisponível.`),
        );
        return { id: product.id, warnings };
      }
      if (hasUrls && ctx.media) {
        const w = await applyProductImagesFromUrls(
          ctx.media,
          ctx.productService,
          product.id,
          obj.data,
        );
        warnings.push(...w);
      }
      return { id: product.id, warnings };
    }
    case "product_variant": {
      const productId = refMap[obj.data.productRef];
      if (!productId) throw new Error(`productRef "${obj.data.productRef}" não resolvido.`);
      const { productRef: _pr, ...rest } = obj.data;
      const variantInput = { ...rest, productId } as CreateVariantInput;
      const v = await ctx.productService.createVariant(variantInput);
      return { id: v.id, warnings };
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
      return { id: row.id, warnings };
    }
    case "inventory_movement": {
      const productId = obj.data.productId ?? refMap[obj.data.productRef!];
      const locationId = obj.data.locationId ?? refMap[obj.data.locationRef!];
      if (!productId) throw new Error("productId/productRef em falta.");
      if (!locationId) throw new Error("locationId/locationRef em falta.");
      const movement = await ctx.inventoryService.addMovement({
        productId,
        variantId: obj.data.variantId,
        locationId,
        type: obj.data.type,
        quantity: obj.data.quantity,
        unitCostCents: obj.data.unitCostCents,
        referenceType: obj.data.referenceType,
        referenceId: obj.data.referenceId,
        notes: obj.data.notes,
      });
      return { id: movement.id, warnings };
    }
    case "order": {
      const customerId = obj.data.customerId ?? refMap[obj.data.customerRef!];
      if (!customerId) throw new Error("customerId/customerRef em falta.");
      const items = obj.data.items.map((it) => ({
        productId: it.productId ?? (it.productRef ? refMap[it.productRef] : undefined),
        variantId: it.variantId,
        sku: it.sku,
        name: it.name,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        discountCents: it.discountCents,
      }));
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
      return { id: order.id, warnings };
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
      return { id: po.id, warnings };
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
    media,
  };

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

      for (const obj of sortedObjects) {
        const originalIndex = originalIndexMap.get(obj) ?? -1;
        const itemBase: Omit<IngestionItemResult, "status" | "id" | "error" | "warnings"> = {
          index: originalIndex,
          type: obj.type,
          clientRef: obj.client_ref,
        };

        try {
          const { id, warnings } = await createIngestionObject(obj, ctx, refMap);
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
