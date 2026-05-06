-- Jobs de ingestão assíncrona (fila Cloudflare + progresso na UI)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  payload_json TEXT NOT NULL,
  progress_processed INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS ingestion_jobs_status_idx ON ingestion_jobs (status);
CREATE INDEX IF NOT EXISTS ingestion_jobs_created_at_idx ON ingestion_jobs (created_at);
