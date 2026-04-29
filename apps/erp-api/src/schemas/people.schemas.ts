import { z } from "zod";
import { createPartySchema } from "./party.schemas.js";

export const createCustomerWithPartySchema = createPartySchema.extend({
  origin: z.enum(["ecommerce", "event", "manual", "imported"]).optional(),
});

export const listCustomersQuerySchema = z.object({
  status: z.enum(["active", "inactive", "blocked"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createSupplierWithPartySchema = createPartySchema.extend({
  stateRegistration: z.string().max(30).optional(),
  contactName: z.string().max(200).optional(),
});

export const listSuppliersQuerySchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCustomerWithPartyInput = z.infer<typeof createCustomerWithPartySchema>;
export type CreateSupplierWithPartyInput = z.infer<typeof createSupplierWithPartySchema>;
