import { z } from "zod";
import {
  createProductSchema,
  createCategorySchema,
  createCollectionSchema,
  createVariantSchema,
  productCompositionDataWithoutChildSchema,
  refineProductComposition,
  productTypeSchema,
} from "./product.schemas.js";
import { createPartySchema } from "./party.schemas.js";
import { createCustomerWithPartySchema, createSupplierWithPartySchema } from "./people.schemas.js";
import { createOrderSchema } from "./order.schemas.js";
import { createPurchaseOrderSchema } from "./purchase.schemas.js";

const clientRefField = z.string().min(1).max(200).optional();

const httpsImageUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https:"), { message: "URL da imagem deve usar HTTPS." });

/** --- Stock location (igual a POST /inventory/locations) --- */
export const stockLocationIngestionDataSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["main", "event", "production", "damaged", "reserved", "third_party"]),
  address: z.string().optional(),
});

/** --- Category --- */
export const categoryIngestionDataSchema = createCategorySchema.extend({
  parentCategoryRef: z.string().min(1).max(200).optional(),
});

/** --- Collection --- */
export const collectionIngestionDataSchema = createCollectionSchema;

/** --- Party / customer / supplier --- */
export const partyIngestionDataSchema = createPartySchema;
export const customerIngestionDataSchema = createCustomerWithPartySchema;
export const supplierIngestionDataSchema = createSupplierWithPartySchema;

/** --- Product + imagens + refs no payload ---
 * `productType` / `status` como string + superRefine: mensagens explícitas (ex.: finished_good, publish).
 * `.strict()`: chaves desconhecidas em `data` falham (exceto object keys dentro de `metadata`).
 */
const productStatusesIngestion = ["draft", "active", "inactive", "archived"] as const;

const productIngestionBodySchema = createProductSchema
  .omit({ productType: true, status: true })
  .extend({
    productType: z.string(),
    status: z.string().optional(),
  });

export const productIngestionDataSchema = productIngestionBodySchema
  .extend({
    main_image_url: httpsImageUrl.optional(),
    gallery_image_urls: z.array(httpsImageUrl).max(50).optional(),
    categoryRef: z.string().min(1).max(200).optional(),
    collectionRef: z.string().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!productTypeSchema.safeParse(data.productType).success) {
      const pt = data.productType;
      let msg = `productType inválido. Valores aceites: ${productTypeSchema.options.join(", ")}.`;
      if (pt === "finished_good") {
        msg +=
          ' Sugestão: para produto acabado vendável ao cliente use "finished_product" (não "finished_good").';
      }
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productType"], message: msg });
    }
    const statusVal = data.status ?? "draft";
    if (!(productStatusesIngestion as readonly string[]).includes(statusVal)) {
      let msg = `status inválido. Valores aceites: ${productStatusesIngestion.join(", ")}.`;
      if (statusVal === "publish") {
        msg += ' Sugestão: WooCommerce "publish" corresponde a status "active" no ERP.';
      }
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: msg });
    }
  });

/** --- Variant: product via client_ref --- */
export const productVariantIngestionDataSchema = createVariantSchema
  .omit({ productId: true })
  .extend({
    productRef: z.string().min(1).max(200),
  });

/** --- Composition: parent/child por ref ou SKU --- */
export const productCompositionIngestionDataSchema = productCompositionDataWithoutChildSchema
  .extend({
    parentProductRef: z.string().min(1).max(200),
    childProductRef: z.string().min(1).max(200).optional(),
    childSku: z.string().min(1).max(100).optional(),
  })
  .refine((d) => d.childProductRef || d.childSku, {
    message:
      "Indique childProductRef (mesmo payload) ou childSku (SKU existente ou criado no lote).",
    path: ["childProductRef"],
  })
  .superRefine((d, ctx) => {
    refineProductComposition(
      {
        ...d,
        childProductId: "_placeholder",
      } as Parameters<typeof refineProductComposition>[0],
      ctx,
    );
  });

/** --- Movimento de stock: refs opcionais em alternativa a IDs --- */
export const inventoryMovementTypeValues = [
  "purchase",
  "sale",
  "return",
  "adjustment",
  "production_in",
  "production_out",
  "transfer_in",
  "transfer_out",
  "damaged",
  "reservation",
  "release_reservation",
] as const;

const movementBase = z.object({
  productId: z.string().min(1).optional(),
  productRef: z.string().min(1).max(200).optional(),
  variantId: z.string().optional(),
  /** `client_ref` de um `product_variant` no mesmo payload (resolvido na execução). */
  variantRef: z.string().min(1).max(200).optional(),
  locationId: z.string().min(1).optional(),
  locationRef: z.string().min(1).max(200).optional(),
  /** Validado em superRefine (mensagens para valores típicos de importação, ex. initial_stock). */
  type: z.string(),
  quantity: z.number().int().min(1),
  unitCostCents: z.number().int().min(0).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});
export const inventoryMovementIngestionDataSchema = movementBase
  .strict()
  .refine((d) => (d.productId || d.productRef) && (d.locationId || d.locationRef), {
    message: "É necessário productId ou productRef, e locationId ou locationRef.",
  })
  .superRefine((data, ctx) => {
    const t = data.type;
    if ((inventoryMovementTypeValues as readonly string[]).includes(t)) return;
    if (t === "initial_stock") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message:
          'Tipo inválido "initial_stock". Para carga inicial de stock ou legado use type "adjustment".',
      });
      return;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: `Tipo de movimento inválido. Valores aceites: ${inventoryMovementTypeValues.join(", ")}. Recebido: ${t}`,
    });
  });

const orderItemWithRef = z.object({
  productId: z.string().optional(),
  productRef: z.string().min(1).max(200).optional(),
  variantId: z.string().optional(),
  variantRef: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  quantity: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).optional().default(0),
});

export const orderIngestionDataSchema = createOrderSchema
  .omit({ items: true })
  .extend({
    customerRef: z.string().min(1).max(200).optional(),
    items: z.array(orderItemWithRef).min(1),
  })
  .refine((d) => d.customerId || d.customerRef, {
    message: "Indique customerId ou customerRef.",
    path: ["customerRef"],
  });

const purchaseItemWithRef = z.object({
  productId: z.string().optional(),
  productRef: z.string().min(1).max(200).optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const purchaseOrderIngestionDataSchema = createPurchaseOrderSchema
  .omit({ items: true })
  .extend({
    supplierRef: z.string().min(1).max(200).optional(),
    items: z.array(purchaseItemWithRef).min(1),
  })
  .refine((d) => d.supplierId || d.supplierRef, {
    message: "Indique supplierId ou supplierRef.",
    path: ["supplierRef"],
  });

export const ingestionObjectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stock_location"),
    client_ref: clientRefField,
    data: stockLocationIngestionDataSchema,
  }),
  z.object({
    type: z.literal("category"),
    client_ref: clientRefField,
    data: categoryIngestionDataSchema,
  }),
  z.object({
    type: z.literal("collection"),
    client_ref: clientRefField,
    data: collectionIngestionDataSchema,
  }),
  z.object({
    type: z.literal("party"),
    client_ref: clientRefField,
    data: partyIngestionDataSchema,
  }),
  z.object({
    type: z.literal("customer"),
    client_ref: clientRefField,
    data: customerIngestionDataSchema,
  }),
  z.object({
    type: z.literal("supplier"),
    client_ref: clientRefField,
    data: supplierIngestionDataSchema,
  }),
  z.object({
    type: z.literal("product"),
    client_ref: clientRefField,
    data: productIngestionDataSchema,
  }),
  z.object({
    type: z.literal("product_variant"),
    client_ref: clientRefField,
    data: productVariantIngestionDataSchema,
  }),
  z.object({
    type: z.literal("product_composition"),
    client_ref: clientRefField,
    data: productCompositionIngestionDataSchema,
  }),
  z.object({
    type: z.literal("inventory_movement"),
    client_ref: clientRefField,
    data: inventoryMovementIngestionDataSchema,
  }),
  z.object({
    type: z.literal("order"),
    client_ref: clientRefField,
    data: orderIngestionDataSchema,
  }),
  z.object({
    type: z.literal("purchase_order"),
    client_ref: clientRefField,
    data: purchaseOrderIngestionDataSchema,
  }),
]);

export const ingestionPayloadSchema = z.object({
  version: z.literal("1.0"),
  mode: z.literal("create"),
  objects: z.array(ingestionObjectSchema).min(1).max(200),
});

export type IngestionPayload = z.infer<typeof ingestionPayloadSchema>;
export type IngestionObject = z.infer<typeof ingestionObjectSchema>;
export type IngestionObjectType = IngestionObject["type"];

export const INGESTION_TYPE_LABELS: Record<IngestionObjectType, string> = {
  stock_location: "Local de stock",
  category: "Categoria",
  collection: "Coleção",
  party: "Entidade (party)",
  customer: "Cliente",
  supplier: "Fornecedor",
  product: "Produto",
  product_variant: "Variante de produto",
  product_composition: "Composição (BOM/embalagem)",
  inventory_movement: "Movimento de stock",
  order: "Pedido",
  purchase_order: "Ordem de compra",
};

export type ProductIngestionData = z.infer<typeof productIngestionDataSchema>;

/** Ordem de execução (dependências primeiro). */
export const INGESTION_TYPE_ORDER: Record<IngestionObjectType, number> = {
  stock_location: 0,
  category: 1,
  collection: 2,
  party: 3,
  customer: 4,
  supplier: 5,
  product: 6,
  product_variant: 7,
  product_composition: 8,
  inventory_movement: 9,
  order: 10,
  purchase_order: 11,
};
