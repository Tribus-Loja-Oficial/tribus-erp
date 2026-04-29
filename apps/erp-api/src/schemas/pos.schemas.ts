import { z } from "zod";

export const createCashRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(200).optional(),
});

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().min(1),
  openedBy: z.string().min(1),
  openingAmountCents: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional(),
});

export const closeCashSessionSchema = z.object({
  closedBy: z.string().min(1),
  closingAmountCents: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

const posSaleItemSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
});

const posPaymentSchema = z.object({
  method: z.enum(["cash", "credit_card", "debit_card", "pix", "bank_transfer", "marketplace", "other"]),
  amountCents: z.number().int().min(1),
});

export const createPosSaleSchema = z.object({
  cashSessionId: z.string().min(1),
  customerId: z.string().optional(),
  items: z.array(posSaleItemSchema).min(1),
  payments: z.array(posPaymentSchema).min(1),
  discountCents: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional(),
});

export const addCashMovementSchema = z.object({
  cashSessionId: z.string().min(1),
  type: z.enum(["cash_in", "cash_out", "adjustment"]),
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "pix", "bank_transfer", "marketplace", "other"]),
  amountCents: z.number().int().min(1),
  notes: z.string().max(500).optional(),
});

export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type CreatePosSaleInput = z.infer<typeof createPosSaleSchema>;
export type AddCashMovementInput = z.infer<typeof addCashMovementSchema>;
