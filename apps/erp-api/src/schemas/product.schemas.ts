import { z } from "zod";

export const productTypeSchema = z.enum([
  "finished_product",
  "raw_material",
  "packaging",
  "kit",
  "bundle",
  "service",
  "consumable",
]);

export const unitOfMeasureSchema = z.enum([
  "unit",
  "pair",
  "meter",
  "gram",
  "kg",
  "liter",
  "package",
]);

export const compositionTypeSchema = z.enum([
  "packaging",
  "bom",
  "kit",
  "bundle",
  "accessory",
  "included",
]);

export const packagingChannelSchema = z.enum(["online", "presential"]);

export const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),
  internalName: z.string().max(300).optional(),
  internalDescription: z.string().max(5000).optional(),
  productType: productTypeSchema,
  categoryId: z.string().optional(),
  collectionId: z.string().optional(),
  niche: z.string().max(100).optional(),
  brand: z.string().max(120).optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("draft"),
  unitOfMeasure: unitOfMeasureSchema.default("unit"),
  barcode: z.string().max(80).optional(),
  ncm: z.string().max(10).optional(),
  cest: z.string().max(10).optional(),
  cfopDefault: z.string().max(10).optional(),
  origin: z.string().max(8).default("0"),
  costPriceCents: z.number().int().min(0).default(0),
  salePriceCents: z.number().int().min(0).default(0),
  compareAtPriceCents: z.number().int().min(0).optional(),
  promotionalPriceCents: z.number().int().min(0).optional(),
  eventPriceCents: z.number().int().min(0).optional(),
  wholesalePriceCents: z.number().int().min(0).optional(),
  controlsStock: z.boolean().optional(),
  minStock: z.number().int().min(0).default(0),
  maxStock: z.number().int().min(0).optional(),
  idealStock: z.number().int().min(0).optional(),
  defaultStockLocationId: z.string().optional(),
  weightGrams: z.number().int().min(0).optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  producedInternally: z.boolean().optional(),
  averageProductionTimeMinutes: z.number().int().min(0).optional(),
  /** Custo de mão de obra por hora (centavos); persiste em product_production_profiles. */
  laborCostPerHourCents: z.number().int().min(0).nullish(),
  productionProfileNotes: z.string().max(2000).nullish(),
  purchaseUnit: z.string().max(80).nullish(),
  purchaseQuantity: z.number().positive().nullish(),
  consumptionUnit: z.string().max(80).nullish(),
  acquisitionCostCents: z.number().int().min(0).nullish(),
  /** Cents por unidade de consumo (ex.: por cm); pode ser fraccionário. */
  costPerConsumptionUnitCents: z.number().min(0).nullish(),
  sellable: z.boolean().optional(),
  availableForEcommerce: z.boolean().optional(),
  availableForPos: z.boolean().optional(),
  availableForEvents: z.boolean().optional(),
  mainImageFileId: z.string().optional(),
  /** IDs de arquivo no storage abstrato (galeria); persistido como JSON no D1. */
  imagesJson: z.array(z.string().max(200)).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createVariantSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  attributes: z.record(z.string()).default({}),
  salePriceCents: z.number().int().min(0),
  costPriceCents: z.number().int().min(0).default(0),
  barcode: z.string().max(50).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  parentId: z.string().optional(),
  description: z.string().max(500).optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  niche: z.string().max(100).optional(),
  season: z.string().max(50).optional(),
  status: z.enum(["draft", "active", "archived"]).default("active"),
});

const productCompositionBodySchema = z
  .object({
    childProductId: z.string().min(1),
    quantity: z.number().positive(),
    quantityUnit: z.string().max(80).optional().nullable(),
    compositionType: compositionTypeSchema,
    packagingChannel: packagingChannelSchema.optional().nullable(),
    required: z.boolean().default(true),
    isDefault: z.boolean().default(true),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export function refineProductComposition(
  data: z.infer<typeof productCompositionBodySchema>,
  ctx: z.RefinementCtx,
) {
  if (data.compositionType === "packaging") {
    if (data.packagingChannel !== "online" && data.packagingChannel !== "presential") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Embalagem exige canal online ou presencial",
        path: ["packagingChannel"],
      });
    }
  } else if (data.packagingChannel != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Canal de embalagem só se aplica ao tipo embalagem",
      path: ["packagingChannel"],
    });
  }
}

/** Campos de composição sem `childProductId` (ex.: ingestão com childProductRef / childSku). */
export const productCompositionDataWithoutChildSchema = productCompositionBodySchema.omit({
  childProductId: true,
});

export const createProductCompositionSchema =
  productCompositionBodySchema.superRefine(refineProductComposition);

export const updateProductCompositionSchema = productCompositionBodySchema.partial();

export const listProductsSchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
  productType: productTypeSchema.optional(),
  /** Quando true, restringe a tipos elegíveis para composição (BOM/embalagem). */
  composeCatalog: z.preprocess(
    (v) => v === "1" || v === "true" || v === "yes" || v === true,
    z.boolean().default(false),
  ),
  categoryId: z.string().optional(),
  niche: z.string().optional(),
  stockFilter: z.enum(["in_stock", "out_of_stock", "below_min", "not_controlled"]).optional(),
  channel: z.enum(["sellable", "ecommerce", "pos", "events"]).optional(),
  sortField: z
    .enum(["sku", "name", "type", "status", "salePrice", "stock", "updatedAt"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const bulkProductIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type CreateProductCompositionInput = z.infer<typeof createProductCompositionSchema>;
export type UpdateProductCompositionInput = z.infer<typeof updateProductCompositionSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type BulkProductIdsInput = z.infer<typeof bulkProductIdsSchema>;
