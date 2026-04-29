import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(300),
  quantity: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
});

const orderPaymentSchema = z.object({
  method: z.enum(["cash", "credit_card", "debit_card", "pix", "bank_transfer", "marketplace", "other"]),
  amountCents: z.number().int().min(1),
  externalRef: z.string().optional(),
});

export const createOrderSchema = z.object({
  channel: z.enum(["ecommerce", "pos", "manual", "event", "marketplace"]).default("manual"),
  customerId: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  payments: z.array(orderPaymentSchema).default([]),
  discountTotalCents: z.number().int().min(0).default(0),
  shippingTotalCents: z.number().int().min(0).default(0),
  notes: z.string().max(2000).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "draft",
    "pending_payment",
    "paid",
    "preparing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
  notes: z.string().optional(),
});

export const ingestOrderSchema = z.object({
  sourceSystem: z.enum(["tribus-commerce", "woocommerce", "manual"]),
  externalOrderId: z.string().min(1).max(200),
  channel: z.enum(["ecommerce", "pos", "manual", "event", "marketplace"]).default("ecommerce"),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      documentNumber: z.string().optional(),
      cdsConsumerId: z.string().optional(),
    })
    .optional(),
  items: z.array(orderItemSchema).min(1),
  payments: z.array(orderPaymentSchema).default([]),
  shipping: z
    .object({
      totalCents: z.number().int().min(0).default(0),
      address: z.string().optional(),
    })
    .optional(),
  totals: z.object({
    subtotalCents: z.number().int().min(0),
    discountCents: z.number().int().min(0).default(0),
    shippingCents: z.number().int().min(0).default(0),
    totalCents: z.number().int().min(0),
  }),
  status: z
    .enum(["draft", "pending_payment", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"])
    .default("pending_payment"),
});

export const listOrdersSchema = z.object({
  status: z
    .enum(["draft", "pending_payment", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"])
    .optional(),
  channel: z.enum(["ecommerce", "pos", "manual", "event", "marketplace"]).optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type IngestOrderInput = z.infer<typeof ingestOrderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
