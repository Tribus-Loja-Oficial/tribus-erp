import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createOrderService } from "../services/order.service.js";
import { createFiscalService } from "../services/fiscal.service.js";
import { R2StorageProvider } from "../storage/r2-storage-provider.js";
import { toApiError, ValidationError } from "../errors/app-error.js";
import { verifyInternalToken } from "../auth/verify-internal-token.js";
import { ingestOrderSchema } from "../schemas/order.schemas.js";
import { importXmlSchema } from "../schemas/fiscal.schemas.js";
import {
  ingestionDryRunRequestSchema,
  ingestionPayloadSchema,
} from "../schemas/ingestion.schemas.js";
import { createIngestionService, validateIngestionPayload } from "../services/ingestion.service.js";
import { generateId } from "../utils/id.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import { createIngestionJobRepository } from "../repositories/ingestion-job.repository.js";
import {
  productionOrderConsumptions,
  productionOrderLosses,
  productionOrders,
  bomItems,
  billOfMaterials,
  fiscalDocumentItems,
  documentFiles,
  fiscalDocuments,
  cashMovements,
  cashSessions,
  financialEntries,
  accountsPayable,
  accountsReceivable,
  orderPayments,
  orderItems,
  orders,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  productTagAssignments,
  productCompositions,
  productProductionProfiles,
  productVariants,
  products,
  productCategories,
  productCollections,
  productTags,
  stockLocations,
  cashRegisters,
  financialAccounts,
  chartOfAccounts,
  costCenters,
  partyAddresses,
  customers,
  suppliers,
  parties,
  auditLogs,
  integrationEvents,
  ingestionJobs,
} from "../db/schema/index.js";

const internal = new Hono<{ Bindings: Env }>();

internal.post("/orders/ingest", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = ingestOrderSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);

    const db = createDb(config.db);
    const service = createOrderService(db);
    const { order, created } = await service.ingest(parsed.data);

    return c.json({ data: order, created }, created ? 201 : 200);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

internal.post("/ingestion/validate", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = ingestionPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        message: `${issue.path.length ? `[${issue.path.join(".")}] ` : ""}${issue.message}`,
      }));
      return c.json(
        {
          data: {
            valid: false,
            errors: errors.map((e) => ({ message: e.message })),
            warnings: [],
            summary: { total: 0, byType: {} },
          },
        },
        200,
      );
    }

    const result = validateIngestionPayload(parsed.data);
    const db = createDb(config.db);
    const auditRepo = createAuditRepository(db);
    await auditRepo.insert({
      id: generateId(),
      actorId: null,
      actorType: "api",
      action: "ingestion.validated",
      entityType: "ingestion",
      entityId: "validate",
      metadataJson: JSON.stringify({
        valid: result.valid,
        objectCount: parsed.data.objects.length,
        errorCount: result.errors.length,
      }),
      createdAt: new Date().toISOString(),
    });

    return c.json({ data: result }, 200);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

internal.post("/ingestion/execute", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = ingestionPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
    }

    const db = createDb(config.db);
    const storage = new R2StorageProvider(config.r2);
    const ingestion = createIngestionService(db, storage);
    const result = await ingestion.executeIngestion(parsed.data, { actorId: null });

    const nothingDone = result.created === 0 && result.updated === 0 && result.skipped === 0;
    const status = result.failed === 0 ? 200 : nothingDone ? 422 : 207;
    return c.json({ data: result }, status);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ message: err.message, code: err.code, issues: err.issues }, err.statusCode);
    }
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

/** Simulação sem gravar no banco (validação + plano previsto por objeto). */
internal.post("/ingestion/dry-run", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = ingestionDryRunRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        message: `${issue.path.length ? `[${issue.path.join(".")}] ` : ""}${issue.message}`,
      }));
      return c.json(
        {
          data: {
            dryRun: true as const,
            valid: false,
            errors: errors.map((e) => ({
              message: e.message,
            })),
            warnings: [],
            summary: { total: 0, byType: {} },
            planned: { created: 0, updated: 0, skipped: 0, failed: 0 },
            items: [],
            refMap: {},
          },
        },
        200,
      );
    }

    const db = createDb(config.db);
    const storage = new R2StorageProvider(config.r2);
    const ingestion = createIngestionService(db, storage);
    const result = await ingestion.dryRunIngestion(parsed.data.payload);
    return c.json({ data: result }, 200);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

/** Enfileira ingestão completa para processamento assíncrono (consumer da fila). */
internal.post("/ingestion/jobs", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const queue = c.env.INGESTION_QUEUE;
    if (!queue) {
      return c.json(
        {
          code: "QUEUE_UNAVAILABLE",
          message:
            "INGESTION_QUEUE não configurada. Crie a fila Cloudflare e faça deploy com wrangler (ver docs).",
        },
        503,
      );
    }

    const body = await c.req.json().catch(() => null);
    const parsed = ingestionPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);
    }

    const db = createDb(config.db);
    const jobRepo = createIngestionJobRepository(db);
    const jobId = generateId();
    const ts = new Date().toISOString();
    const total = parsed.data.objects.length;

    await jobRepo.insert({
      id: jobId,
      status: "queued",
      payloadJson: JSON.stringify(parsed.data),
      progressProcessed: 0,
      progressTotal: total,
      resultJson: null,
      errorMessage: null,
      createdAt: ts,
      updatedAt: ts,
      startedAt: null,
      finishedAt: null,
      chunkStateJson: null,
    });

    await queue.send({ jobId });

    return c.json({ data: { jobId, status: "queued" as const } }, 202);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

internal.get("/ingestion/jobs/:id", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const db = createDb(config.db);
    const jobRepo = createIngestionJobRepository(db);
    const id = c.req.param("id")?.trim();
    if (!id) return c.json({ message: "ID inválido" }, 400);

    const job = await jobRepo.findById(id);
    if (!job) return c.json({ message: "Job não encontrado", code: "NOT_FOUND" }, 404);

    let result: unknown = null;
    if (job.resultJson) {
      try {
        result = JSON.parse(job.resultJson) as unknown;
      } catch {
        result = null;
      }
    }

    return c.json(
      {
        data: {
          jobId: job.id,
          status: job.status,
          progress: {
            processed: job.progressProcessed,
            total: job.progressTotal,
          },
          result,
          error: job.errorMessage,
          updatedAt: job.updatedAt,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
        },
      },
      200,
    );
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

internal.post("/fiscal/xml/import", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = importXmlSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ code: "VALIDATION_ERROR", issues: parsed.error.issues }, 400);

    const db = createDb(config.db);
    const storage = config.r2 ? new R2StorageProvider(config.r2) : undefined;
    const service = createFiscalService(db, storage);
    const data = await service.importXml(parsed.data.xmlContent);
    return c.json({ data }, 201);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string,
): Promise<boolean> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: 100000 },
    keyMaterial,
    256,
  );
  const computed = Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === hashHex;
}

internal.post("/auth/verify", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);

    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .safeParse(body);
    if (!parsed.success) return c.json({ user: null }, 200);

    const { email, password } = parsed.data;
    const user = await c.env.TRIBUS_ERP_DB.prepare(
      "SELECT id, email, name, role, password_hash, password_salt FROM users WHERE email = ? LIMIT 1",
    )
      .bind(email)
      .first<{
        id: string;
        email: string;
        name: string;
        role: string;
        password_hash: string;
        password_salt: string;
      }>();

    if (!user) return c.json({ user: null }, 200);

    const valid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) return c.json({ user: null }, 200);

    return c.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      200,
    );
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

internal.post("/data/reset", async (c) => {
  try {
    const config = getEnv(c.env);
    verifyInternalToken(c.req.header("Authorization"), config.erpInternalSecret);
    const db = createDb(config.db);

    // Delete in FK-safe order: most-dependent tables first.
    await db.batch([
      db.delete(productionOrderConsumptions),
      db.delete(productionOrderLosses),
      db.delete(productionOrders),
      db.delete(bomItems),
      db.delete(billOfMaterials),
      db.delete(fiscalDocumentItems),
      db.delete(documentFiles),
      db.delete(fiscalDocuments),
      db.delete(cashMovements),
      db.delete(cashSessions),
      db.delete(financialEntries),
      db.delete(accountsPayable),
      db.delete(accountsReceivable),
      db.delete(orderPayments),
      db.delete(orderItems),
      db.delete(orders),
      db.delete(purchaseOrderItems),
      db.delete(purchaseOrders),
      db.delete(stockMovements),
      db.delete(productTagAssignments),
      db.delete(productCompositions),
      db.delete(productProductionProfiles),
      db.delete(productVariants),
      db.delete(products),
      db.delete(productCategories),
      db.delete(productCollections),
      db.delete(productTags),
      db.delete(stockLocations),
      db.delete(cashRegisters),
      db.delete(financialAccounts),
      db.delete(chartOfAccounts),
      db.delete(costCenters),
      db.delete(partyAddresses),
      db.delete(customers),
      db.delete(suppliers),
      db.delete(parties),
      db.delete(ingestionJobs),
      db.delete(auditLogs),
      db.delete(integrationEvents),
    ]);

    return c.json({ data: { ok: true } }, 200);
  } catch (err) {
    const { message, code, status } = toApiError(err);
    return c.json({ message, code }, status);
  }
});

export { internal };
