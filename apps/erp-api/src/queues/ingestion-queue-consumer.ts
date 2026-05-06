import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createIngestionJobRepository } from "../repositories/ingestion-job.repository.js";
import { createIngestionService, type IngestionChunkState } from "../services/ingestion.service.js";
import { R2StorageProvider } from "../storage/r2-storage-provider.js";
import { ingestionPayloadSchema, type IngestionPayload } from "../schemas/ingestion.schemas.js";
import { logger } from "../observability/logger.js";

type JobMessage = { jobId?: string };

/** Conservador para contas free: menos objectos por execução do consumer. */
const DEFAULT_QUEUE_CHUNK = 5;
/** Orçamento padrão de URLs de imagem por execução (main + galeria). */
const DEFAULT_IMAGE_URL_BUDGET = 12;

function parseChunkState(raw: string | null | undefined): IngestionChunkState | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const o = JSON.parse(String(raw)) as Record<string, unknown>;
    if (typeof o.cursor !== "number" || o.cursor < 0) return null;
    if (typeof o.refMap !== "object" || o.refMap === null || Array.isArray(o.refMap)) return null;
    if (!Array.isArray(o.items)) return null;
    return {
      cursor: o.cursor,
      refMap: o.refMap as Record<string, string>,
      items: o.items as IngestionChunkState["items"],
      created: typeof o.created === "number" ? o.created : 0,
      updated: typeof o.updated === "number" ? o.updated : 0,
      skipped: typeof o.skipped === "number" ? o.skipped : 0,
      failed: typeof o.failed === "number" ? o.failed : 0,
      pendingImageTasks: Array.isArray(o.pendingImageTasks)
        ? (o.pendingImageTasks as IngestionChunkState["pendingImageTasks"])
        : [],
    };
  } catch {
    return null;
  }
}

function queueChunkSize(env: Env): number {
  const n = Number(env.INGESTION_QUEUE_CHUNK_SIZE);
  if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 200);
  return DEFAULT_QUEUE_CHUNK;
}

function imageUrlBudgetPerRun(env: Env): number {
  const n = Number(env.INGESTION_QUEUE_MAX_IMAGE_URLS_PER_RUN);
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.floor(n), 500);
  return DEFAULT_IMAGE_URL_BUDGET;
}

export async function handleIngestionQueue(
  batch: MessageBatch<JobMessage>,
  env: Env,
): Promise<void> {
  const config = getEnv(env);
  const db = createDb(config.db);
  const jobRepo = createIngestionJobRepository(db);
  const storage = new R2StorageProvider(config.r2);
  const ingestion = createIngestionService(db, storage);
  const now = () => new Date().toISOString();
  const queue = env.INGESTION_QUEUE;
  const chunkSize = queueChunkSize(env);
  const imageBudget = imageUrlBudgetPerRun(env);

  for (const msg of batch.messages) {
    try {
      const jobId = typeof msg.body?.jobId === "string" ? msg.body.jobId.trim() : "";
      if (!jobId) {
        msg.ack();
        continue;
      }

      if (!queue) {
        logger.error("ingestion queue consumer: INGESTION_QUEUE binding missing");
        msg.retry();
        continue;
      }

      const job = await jobRepo.findById(jobId);
      if (!job) {
        logger.warn("ingestion queue: job not found", { jobId });
        msg.ack();
        continue;
      }

      if (job.status === "completed" || job.status === "failed") {
        msg.ack();
        continue;
      }

      await jobRepo.updateProgress(jobId, {
        status: "running",
        updatedAt: now(),
        startedAt: job.startedAt ?? now(),
      });

      let rawPayload: unknown;
      try {
        rawPayload = JSON.parse(job.payloadJson);
      } catch {
        await jobRepo.updateProgress(jobId, {
          status: "failed",
          errorMessage: "Falha ao interpretar payload_json do job.",
          updatedAt: now(),
          finishedAt: now(),
          chunkStateJson: null,
        });
        msg.ack();
        continue;
      }

      const rawChunk = job.chunkStateJson;
      const chunkState = parseChunkState(rawChunk);
      if (rawChunk?.trim() && chunkState === null) {
        await jobRepo.updateProgress(jobId, {
          status: "failed",
          errorMessage: "Estado de chunk inválido (chunk_state_json).",
          updatedAt: now(),
          finishedAt: now(),
          chunkStateJson: null,
        });
        msg.ack();
        continue;
      }

      /** Após o 1.º chunk, evita Zod + validação semântica completa (poupa CPU por mensagem). */
      const assumeSemanticValid = chunkState !== null && chunkState.cursor > 0;

      let payloadData: IngestionPayload;
      if (assumeSemanticValid) {
        payloadData = rawPayload as IngestionPayload;
      } else {
        const payloadParsed = ingestionPayloadSchema.safeParse(rawPayload);
        if (!payloadParsed.success) {
          await jobRepo.updateProgress(jobId, {
            status: "failed",
            errorMessage: "Payload armazenado inválido (schema).",
            updatedAt: now(),
            finishedAt: now(),
            chunkStateJson: null,
          });
          msg.ack();
          continue;
        }
        payloadData = payloadParsed.data;
      }

      try {
        const outcome = await ingestion.executeIngestionChunk(payloadData, chunkState, chunkSize, {
          assumePayloadSemanticallyValid: assumeSemanticValid,
          maxImageUrlsPerRun: imageBudget,
        });

        if (outcome.done) {
          await jobRepo.updateProgress(jobId, {
            status: "completed",
            progressProcessed: outcome.result.total,
            progressTotal: outcome.result.total,
            resultJson: JSON.stringify(outcome.result),
            chunkStateJson: null,
            updatedAt: now(),
            finishedAt: now(),
          });
        } else {
          await jobRepo.updateProgress(jobId, {
            status: "running",
            progressProcessed: outcome.processedSoFar,
            progressTotal: outcome.total,
            chunkStateJson: JSON.stringify(outcome.state),
            updatedAt: now(),
          });
          await queue.send({ jobId });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await jobRepo.updateProgress(jobId, {
          status: "failed",
          errorMessage: message,
          updatedAt: now(),
          finishedAt: now(),
          chunkStateJson: null,
        });
        logger.error("ingestion job execute failed", { jobId, error: message });
      }

      msg.ack();
    } catch (e) {
      logger.error("ingestion queue message handler error", { error: String(e) });
      msg.retry();
    }
  }
}
