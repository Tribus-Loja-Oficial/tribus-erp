import type { Env } from "../types/env.js";
import { getEnv } from "../config/env.js";
import { createDb } from "../db/client.js";
import { createIngestionJobRepository } from "../repositories/ingestion-job.repository.js";
import { createIngestionService } from "../services/ingestion.service.js";
import { R2StorageProvider } from "../storage/r2-storage-provider.js";
import { ingestionPayloadSchema } from "../schemas/ingestion.schemas.js";
import { logger } from "../observability/logger.js";

type JobMessage = { jobId?: string };

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

  for (const msg of batch.messages) {
    try {
      const jobId = typeof msg.body?.jobId === "string" ? msg.body.jobId.trim() : "";
      if (!jobId) {
        msg.ack();
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

      let payloadParsed;
      try {
        payloadParsed = ingestionPayloadSchema.safeParse(JSON.parse(job.payloadJson));
      } catch {
        await jobRepo.updateProgress(jobId, {
          status: "failed",
          errorMessage: "Falha ao interpretar payload_json do job.",
          updatedAt: now(),
          finishedAt: now(),
        });
        msg.ack();
        continue;
      }

      if (!payloadParsed.success) {
        await jobRepo.updateProgress(jobId, {
          status: "failed",
          errorMessage: "Payload armazenado inválido (schema).",
          updatedAt: now(),
          finishedAt: now(),
        });
        msg.ack();
        continue;
      }

      const total = payloadParsed.data.objects.length;

      try {
        const result = await ingestion.executeIngestion(payloadParsed.data, {
          actorId: null,
          onProgress: async ({ processed, total: tot }) => {
            await jobRepo.updateProgress(jobId, {
              progressProcessed: processed,
              progressTotal: tot,
              updatedAt: now(),
            });
          },
        });

        await jobRepo.updateProgress(jobId, {
          status: "completed",
          progressProcessed: total,
          progressTotal: total,
          resultJson: JSON.stringify(result),
          updatedAt: now(),
          finishedAt: now(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await jobRepo.updateProgress(jobId, {
          status: "failed",
          errorMessage: message,
          updatedAt: now(),
          finishedAt: now(),
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
