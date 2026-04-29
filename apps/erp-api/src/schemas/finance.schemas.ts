import { z } from "zod";

export const createFinancialAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["bank", "cash", "credit_card", "payment_gateway", "marketplace"]),
  institution: z.string().max(100).optional(),
  currency: z.string().length(3).default("BRL"),
  openingBalanceCents: z.number().int().default(0),
});

export const createFinancialEntrySchema = z.object({
  type: z.enum(["income", "expense", "transfer", "adjustment"]),
  financialAccountId: z.string().min(1),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  amountCents: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  competenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().min(1).max(500),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().max(100).optional(),
});

export const createPayableSchema = z.object({
  supplierId: z.string().optional(),
  description: z.string().min(1).max(500),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  competenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  amountCents: z.number().int().min(1),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const payPayableSchema = z.object({
  amountCents: z.number().int().min(1),
  paymentMethod: z.string().min(1),
  financialAccountId: z.string().min(1),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createReceivableSchema = z.object({
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  description: z.string().min(1).max(500),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().min(1),
  paymentMethod: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const receiveReceivableSchema = z.object({
  amountCents: z.number().int().min(1),
  paymentMethod: z.string().min(1),
  financialAccountId: z.string().min(1),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const listEntriesSchema = z.object({
  type: z.enum(["income", "expense", "transfer", "adjustment"]).optional(),
  accountId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountSchema>;
export type CreateFinancialEntryInput = z.infer<typeof createFinancialEntrySchema>;
export type CreatePayableInput = z.infer<typeof createPayableSchema>;
export type PayPayableInput = z.infer<typeof payPayableSchema>;
export type CreateReceivableInput = z.infer<typeof createReceivableSchema>;
export type ReceiveReceivableInput = z.infer<typeof receiveReceivableSchema>;
