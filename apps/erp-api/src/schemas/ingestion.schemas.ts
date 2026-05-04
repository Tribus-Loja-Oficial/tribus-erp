import { z } from "zod";
import { createProductSchema } from "./product.schemas.js";

/** Campos extra de ingestão de produto (imagens por URL; aplicadas após o create). */
const httpsImageUrl = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https:"), { message: "URL da imagem deve usar HTTPS." });

export const productIngestionDataSchema = createProductSchema.extend({
  main_image_url: httpsImageUrl.optional(),
  gallery_image_urls: z.array(httpsImageUrl).max(50).optional(),
});

export const ingestionObjectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("product"),
    client_ref: z.string().min(1).max(200).optional(),
    data: productIngestionDataSchema,
  }),
]);

export const ingestionPayloadSchema = z.object({
  version: z.literal("1.0"),
  mode: z.literal("create"),
  objects: z.array(ingestionObjectSchema).min(1).max(100),
});

export type IngestionPayload = z.infer<typeof ingestionPayloadSchema>;
export type IngestionObject = z.infer<typeof ingestionObjectSchema>;
export type IngestionObjectType = IngestionObject["type"];
export type ProductIngestionData = z.infer<typeof productIngestionDataSchema>;

export const INGESTION_TYPE_LABELS: Record<IngestionObjectType, string> = {
  product: "Produto",
};
