import { env } from "@/lib/config/env";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${env.erpApiInternalSecret}`,
});

/** Proxy directo para o Worker (sem timeout curto da camada intermédia). */
export async function upstreamIngestionExecute(payload: unknown): Promise<Response> {
  return fetch(`${env.erpApiUrl}/internal/ingestion/execute`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
}

export async function upstreamIngestionDryRun(body: unknown): Promise<Response> {
  return fetch(`${env.erpApiUrl}/internal/ingestion/dry-run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
}

/** Enfileira job de ingestão assíncrona no Worker. */
export async function upstreamIngestionEnqueue(payload: unknown): Promise<Response> {
  return fetch(`${env.erpApiUrl}/internal/ingestion/jobs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
}

export async function upstreamIngestionJob(jobId: string): Promise<Response> {
  const id = encodeURIComponent(jobId.trim());
  return fetch(`${env.erpApiUrl}/internal/ingestion/jobs/${id}`, {
    headers: { Authorization: `Bearer ${env.erpApiInternalSecret}` },
  });
}
