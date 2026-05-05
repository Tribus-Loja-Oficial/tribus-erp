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
