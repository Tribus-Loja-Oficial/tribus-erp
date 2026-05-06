/** Limites por defeito alinhados ao Vercel Hobby (~60s): ingestão maior vai para fila no Worker. */
export const DEFAULT_INGESTION_SYNC_MAX_OBJECTS = 80;
export const DEFAULT_INGESTION_SYNC_MAX_BODY_BYTES = 512 * 1024;

export function ingestionPayloadMetrics(payload: unknown): {
  objectCount: number;
  byteLength: number;
} {
  const objectCount =
    typeof payload === "object" &&
    payload !== null &&
    "objects" in payload &&
    Array.isArray((payload as { objects: unknown }).objects)
      ? (payload as { objects: unknown[] }).objects.length
      : 0;
  const byteLength = new TextEncoder().encode(JSON.stringify(payload)).length;
  return { objectCount, byteLength };
}

export function shouldEnqueueIngestionAsync(payload: unknown): boolean {
  const maxObj = Number(
    process.env.INGESTION_SYNC_MAX_OBJECTS ?? String(DEFAULT_INGESTION_SYNC_MAX_OBJECTS),
  );
  const maxBytes = Number(
    process.env.INGESTION_SYNC_MAX_BODY_BYTES ?? String(DEFAULT_INGESTION_SYNC_MAX_BODY_BYTES),
  );
  const { objectCount, byteLength } = ingestionPayloadMetrics(payload);
  if (!Number.isFinite(maxObj) || !Number.isFinite(maxBytes)) {
    return (
      objectCount > DEFAULT_INGESTION_SYNC_MAX_OBJECTS ||
      byteLength > DEFAULT_INGESTION_SYNC_MAX_BODY_BYTES
    );
  }
  return objectCount > maxObj || byteLength > maxBytes;
}
