import { z } from "zod";

export const createPartySchema = z.object({
  type: z.enum(["individual", "company"]),
  legalName: z.string().min(1).max(200),
  tradeName: z.string().max(200).optional(),
  documentType: z.enum(["cpf", "cnpj", "foreign", "unknown"]).default("unknown"),
  documentNumber: z.string().max(20).optional(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  cdsConsumerId: z.string().max(100).optional(),
});

export const updatePartySchema = createPartySchema.partial();

export const createAddressSchema = z.object({
  partyId: z.string().min(1),
  label: z.string().max(50).default("principal"),
  street: z.string().min(1).max(200),
  number: z.string().max(20).optional(),
  complement: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  postalCode: z.string().min(8).max(9),
  country: z.string().length(2).default("BR"),
  isDefault: z.boolean().default(false),
});

export const listPartiesSchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(["individual", "company"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type ListPartiesInput = z.infer<typeof listPartiesSchema>;
