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
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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

export const purchaseReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string().optional(),
  productId: z.string().optional(),
  description: z.string().optional(),
  purchasedQuantity: z.number().positive(),
  purchaseUnit: z.string().min(1),
  stockQuantity: z.number().positive(),
  stockUnit: z.string().min(1),
  grossAmountCents: z.number().int().nonnegative(),
  discountAmountCents: z.number().int().nonnegative().default(0),
  freightAmountCents: z.number().int().nonnegative().default(0),
  taxAmountCents: z.number().int().nonnegative().default(0),
  otherCostAmountCents: z.number().int().nonnegative().default(0),
  totalCostCents: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createPurchaseReceiptSchema = z.object({
  externalRef: z.string().min(1).optional(),
  purchaseOrderId: z.string().optional(),
  supplierId: z.string().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receivedAt: z.string().datetime().optional(),
  documentNumber: z.string().optional(),
  documentType: z
    .enum(["manual", "nfe_xml", "receipt", "invoice", "legacy_import"])
    .default("manual"),
  sourceSystem: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  locationId: z.string(),
  items: z.array(purchaseReceiptItemSchema).min(1),
});

export const listPurchaseReceiptsSchema = z.object({
  supplierId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseStatusInput = z.infer<typeof updatePurchaseStatusSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type ListPurchaseOrdersParams = z.infer<typeof listPurchaseOrdersSchema>;
export type CreatePurchaseReceiptInput = z.infer<typeof createPurchaseReceiptSchema>;
export type ListPurchaseReceiptsParams = z.infer<typeof listPurchaseReceiptsSchema>;
