import { z } from "zod";

export const purchaseOrderItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  freightAmountCents: z.number().int().nonnegative().default(0),
  discountAmountCents: z.number().int().nonnegative().default(0),
  taxAmountCents: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
});

export const updatePurchaseStatusSchema = z.object({
  status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]),
});

export const receivePurchaseItemSchema = z.object({
  purchaseOrderItemId: z.string(),
  receivedQuantity: z.number().positive(),
});

export const receivePurchaseOrderSchema = z.object({
  items: z.array(receivePurchaseItemSchema).min(1),
  locationId: z.string(),
  notes: z.string().optional(),
});

export const listPurchaseOrdersSchema = z.object({
  status: z.string().optional(),
  supplierId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseStatusInput = z.infer<typeof updatePurchaseStatusSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type ListPurchaseOrdersParams = z.infer<typeof listPurchaseOrdersSchema>;
