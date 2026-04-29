import { z } from "zod";

export const CreateBomItemSchema = z.object({
  componentProductId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("un"),
  unitCostCents: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const CreateBomSchema = z.object({
  productId: z.string().min(1),
  version: z.string().default("1.0"),
  notes: z.string().optional(),
  items: z.array(CreateBomItemSchema).min(1),
});

export const CreateProductionOrderSchema = z.object({
  productId: z.string().min(1),
  bomId: z.string().optional(),
  quantityPlanned: z.number().int().positive(),
  notes: z.string().optional(),
});

export const StartProductionOrderSchema = z.object({
  startedAt: z.string().optional(),
});

export const CompleteProductionOrderSchema = z.object({
  quantityProduced: z.number().int().positive(),
  locationId: z.string().min(1),
  losses: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const ListProductionOrdersSchema = z.object({
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateBomInput = z.infer<typeof CreateBomSchema>;
export type CreateProductionOrderInput = z.infer<typeof CreateProductionOrderSchema>;
export type StartProductionOrderInput = z.infer<typeof StartProductionOrderSchema>;
export type CompleteProductionOrderInput = z.infer<typeof CompleteProductionOrderSchema>;
export type ListProductionOrdersParams = z.infer<typeof ListProductionOrdersSchema>;
