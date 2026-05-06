export interface Env {
  ENVIRONMENT: string;
  CDS_API_URL?: string;
  CDS_JWT_ISSUER?: string;
  CDS_JWT_AUDIENCE?: string;
  ERP_INTERNAL_SECRET: string;
  CDS_JWT_SECRET: string;
  MONITOR_API_URL?: string;
  MONITOR_COVERAGE_TOKEN?: string;
  TRIBUS_ERP_DB: D1Database;
  TRIBUS_ERP_R2: R2Bucket;
  /** Fila para ingestão assíncrona (`wrangler queues create`). Opcional em dev sem fila. */
  INGESTION_QUEUE?: Queue<{ jobId: string }>;
  /** Máx. objectos por invocação do consumer (evita exceededCpu). Opcional; default 5. */
  INGESTION_QUEUE_CHUNK_SIZE?: string;
  /** Máx. URLs de imagens por execução do chunk (main + galeria). Opcional; default 12. */
  INGESTION_QUEUE_MAX_IMAGE_URLS_PER_RUN?: string;
}
