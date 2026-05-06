import type { IngestionExecuteResponse } from "@/server/ingestion-actions";

/**
 * Chamadas da UI às rotas `/api/admin/ingestion/*` (timeout alargado vs Server Actions).
 */
export async function postAdminIngestionJson<T>(
  path: "/api/admin/ingestion/execute" | "/api/admin/ingestion/dry-run",
  body: unknown,
  additionalOkStatuses: number[] = [],
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = rawText.trim() ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      res.ok
        ? `Resposta inválida da app (${res.status}): não é JSON.`
        : rawText.slice(0, 280) || `HTTP ${res.status} (corpo não JSON)`,
    );
  }

  const ok = res.ok || additionalOkStatuses.includes(res.status);

  if (!ok) {
    const d = data as {
      message?: string;
      code?: string;
      issues?: Array<{ path?: (string | number)[]; message?: string }>;
    };
    if (d.code === "VALIDATION_ERROR" && Array.isArray(d.issues) && d.issues.length > 0) {
      const first = d.issues[0]!;
      const issuePath = first.path?.length ? first.path.join(".") : "";
      const detail = [issuePath, first.message].filter(Boolean).join(": ");
      throw new Error(detail || d.message || `HTTP ${res.status}`);
    }
    throw new Error(d.message ?? `HTTP ${res.status}`);
  }

  return data as T;
}

export type IngestionJobStatusPayload = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: { processed: number; total: number };
  result: IngestionExecuteResponse["data"] | null;
  error: string | null;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

/** POST execute: síncrono (200/207/422) ou assíncrono (202 + jobId). */
export async function postAdminIngestionExecute(
  payload: unknown,
): Promise<
  | { mode: "sync"; httpStatus: number; result: IngestionExecuteResponse["data"] }
  | { mode: "async"; httpStatus: 202; jobId: string }
> {
  const res = await fetch("/api/admin/ingestion/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = rawText.trim() ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      res.ok
        ? `Resposta inválida da app (${res.status}): não é JSON.`
        : rawText.slice(0, 280) || `HTTP ${res.status} (corpo não JSON)`,
    );
  }

  if (res.status === 202) {
    const d = data as { data?: { jobId?: string } };
    const jobId = d.data?.jobId?.trim();
    if (!jobId) throw new Error("Resposta 202 sem jobId.");
    return { mode: "async", httpStatus: 202, jobId };
  }

  if (res.status === 503) {
    const d = data as { code?: string; message?: string };
    throw new Error(
      d.message ??
        (d.code === "QUEUE_UNAVAILABLE"
          ? "Fila de ingestão indisponível: configure INGESTION_QUEUE no Worker e crie a fila Cloudflare (ver docs de deploy)."
          : "Serviço temporariamente indisponível (503)."),
    );
  }

  const ok = res.ok || res.status === 207 || res.status === 422;
  if (!ok) {
    const d = data as {
      message?: string;
      code?: string;
      issues?: Array<{ path?: (string | number)[]; message?: string }>;
    };
    if (d.code === "VALIDATION_ERROR" && Array.isArray(d.issues) && d.issues.length > 0) {
      const first = d.issues[0]!;
      const issuePath = first.path?.length ? first.path.join(".") : "";
      const detail = [issuePath, first.message].filter(Boolean).join(": ");
      throw new Error(detail || d.message || `HTTP ${res.status}`);
    }
    throw new Error(d.message ?? `HTTP ${res.status}`);
  }

  const envelope = data as IngestionExecuteResponse;
  if (!envelope.data) throw new Error("Resposta sync sem data.");
  return { mode: "sync", httpStatus: res.status, result: envelope.data };
}

export async function fetchAdminIngestionJob(jobId: string): Promise<IngestionJobStatusPayload> {
  const res = await fetch(`/api/admin/ingestion/jobs/${encodeURIComponent(jobId.trim())}`, {
    credentials: "include",
  });
  const rawText = await res.text();
  let data: unknown;
  try {
    data = rawText.trim() ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(rawText.slice(0, 280) || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    const d = data as { message?: string };
    throw new Error(d.message ?? `HTTP ${res.status}`);
  }
  const envelope = data as { data?: IngestionJobStatusPayload };
  if (!envelope.data) throw new Error("Resposta sem data.");
  return envelope.data;
}
