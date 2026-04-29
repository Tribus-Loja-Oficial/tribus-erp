import { z } from "zod";

export const importXmlSchema = z.object({
  xmlContent: z.string().min(1),
  storageKey: z.string().optional(),
});

export const createFiscalDocumentSchema = z.object({
  type: z.enum(["nfe", "nfce", "nfse", "cte", "other"]),
  accessKey: z.string().max(44).optional(),
  number: z.string().max(20).optional(),
  series: z.string().max(5).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emitterPartyId: z.string().optional(),
  recipientPartyId: z.string().optional(),
  totalAmountCents: z.number().int().min(0),
  rawXmlStorageKey: z.string().optional(),
});

export const listFiscalDocumentsSchema = z.object({
  type: z.enum(["nfe", "nfce", "nfse", "cte", "other"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ImportXmlInput = z.infer<typeof importXmlSchema>;
export type CreateFiscalDocumentInput = z.infer<typeof createFiscalDocumentSchema>;
