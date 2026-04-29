import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { ConflictError, BadRequestError } from "../errors/app-error.js";
import { createFiscalRepository } from "../repositories/fiscal.repository.js";
import { createPartyRepository } from "../repositories/party.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type { StorageProvider } from "../storage/storage-provider.js";

export interface ParsedNfe {
  accessKey: string;
  number: string;
  series: string;
  issueDate: string;
  emitter: {
    cnpj?: string;
    cpf?: string;
    legalName: string;
    ie?: string;
  };
  recipient: {
    cnpj?: string;
    cpf?: string;
    name: string;
  };
  items: Array<{
    description: string;
    ncm?: string;
    cfop?: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
  }>;
  totalAmountCents: number;
}

export function parseNfeXml(xml: string): ParsedNfe {
  // Lightweight XML parsing using regex — no DOM library needed in Workers
  const get = (tag: string, source = xml): string => {
    const match = source.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
    return match?.[1]?.trim() ?? "";
  };

  const getAll = (tag: string): string[] => {
    const matches = [];
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "g");
    let m;
    while ((m = regex.exec(xml)) !== null) {
      matches.push(m[1] ?? "");
    }
    return matches;
  };

  const accessKey = get("chNFe") || get("Id").replace("NFe", "");
  const issueDate = get("dhEmi").slice(0, 10) || get("dEmi");
  const number = get("nNF");
  const series = get("serie");
  const totalStr = get("vNF");
  const totalAmountCents = Math.round(parseFloat(totalStr || "0") * 100);

  const emitterBlock = xml.match(/<emit>([\s\S]*?)<\/emit>/)?.[1] ?? "";
  const recipientBlock = xml.match(/<dest>([\s\S]*?)<\/dest>/)?.[1] ?? "";

  const emitter = {
    cnpj: get("CNPJ", emitterBlock) || undefined,
    cpf: get("CPF", emitterBlock) || undefined,
    legalName: get("xNome", emitterBlock) || get("xFant", emitterBlock),
    ie: get("IE", emitterBlock) || undefined,
  };

  const recipient = {
    cnpj: get("CNPJ", recipientBlock) || undefined,
    cpf: get("CPF", recipientBlock) || undefined,
    name: get("xNome", recipientBlock),
  };

  const itemBlocks = getAll("det");
  const items = itemBlocks.map((block) => ({
    description: get("xProd", block),
    ncm: get("NCM", block) || undefined,
    cfop: get("CFOP", block) || undefined,
    quantity: parseFloat(get("qCom", block) || "0"),
    unitValue: parseFloat(get("vUnCom", block) || "0"),
    totalValue: parseFloat(get("vProd", block) || "0"),
  }));

  return { accessKey, number, series, issueDate, emitter, recipient, items, totalAmountCents };
}

export function createFiscalService(db: AppDb, storage?: StorageProvider) {
  const fiscalRepo = createFiscalRepository(db);
  const partiesRepo = createPartyRepository(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    async importXml(xmlContent: string, actorId?: string) {
      let parsed: ParsedNfe;
      try {
        parsed = parseNfeXml(xmlContent);
      } catch {
        throw new BadRequestError("Failed to parse XML. Please check the file format.");
      }

      if (!parsed.accessKey) {
        throw new BadRequestError("Could not extract access key from XML");
      }

      const existing = await fiscalRepo.findByAccessKey(parsed.accessKey);
      if (existing) throw new ConflictError(`Document with access key already imported: ${parsed.accessKey}`);

      let storageKey: string | undefined;
      if (storage) {
        storageKey = `fiscal/nfe/${parsed.issueDate.slice(0, 7)}/${parsed.accessKey}.xml`;
        await storage.putObject({
          key: storageKey,
          body: xmlContent,
          contentType: "application/xml",
          metadata: { accessKey: parsed.accessKey },
        });
      }

      const document = await fiscalRepo.insert({
        id: generateId(),
        type: "nfe",
        accessKey: parsed.accessKey,
        number: parsed.number || null,
        series: parsed.series || null,
        issueDate: parsed.issueDate,
        emitterPartyId: null,
        recipientPartyId: null,
        totalAmountCents: parsed.totalAmountCents,
        xmlFileId: null,
        status: "active",
        rawXmlStorageKey: storageKey ?? null,
        createdAt: now(),
        updatedAt: now(),
      });

      for (const item of parsed.items) {
        await fiscalRepo.insertItem({
          id: generateId(),
          fiscalDocumentId: document.id,
          productId: null,
          description: item.description,
          ncm: item.ncm ?? null,
          cfop: item.cfop ?? null,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: item.totalValue,
          createdAt: now(),
        });
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "fiscal.xml.imported",
        entityType: "fiscal_document",
        entityId: document.id,
        afterJson: JSON.stringify({ accessKey: parsed.accessKey, total: parsed.totalAmountCents }),
        createdAt: now(),
      });

      return { document, parsed };
    },

    async findById(id: string) {
      const doc = await fiscalRepo.findById(id);
      if (!doc) throw new Error(`Fiscal document ${id} not found`);
      const items = await fiscalRepo.findItemsByDocument(id);
      return { ...doc, items };
    },

    async findMany(params?: { page?: number; limit?: number }) {
      const { page = 1, limit = 20 } = params ?? {};
      return fiscalRepo.findMany({ limit, offset: (page - 1) * limit });
    },
  };
}
