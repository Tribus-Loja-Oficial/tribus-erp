import { z } from "zod";

export const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),
  productType: z.enum(["simple", "kit", "bundle", "service", "raw_material"]).default("simple"),
  categoryId: z.string().optional(),
  collectionId: z.string().optional(),
  niche: z.string().max(100).optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("draft"),
  unitOfMeasure: z.string().max(10).default("un"),
  barcode: z.string().max(50).optional(),
  ncm: z.string().max(10).optional(),
  cest: z.string().max(10).optional(),
  cfopDefault: z.string().max(10).optional(),
  origin: z.string().max(2).default("0"),
  costPriceCents: z.number().int().min(0).default(0),
  salePriceCents: z.number().int().min(0).default(0),
  compareAtPriceCents: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).default(0),
  maxStock: z.number().int().min(0).optional(),
  weightGrams: z.number().int().min(0).optional(),
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
});

export const listProductsSchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
  categoryId: z.string().optional(),
  niche: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
