-- Estado persistido entre invocações do consumer (ingestão por chunks na fila)
ALTER TABLE ingestion_jobs ADD COLUMN chunk_state_json TEXT;
