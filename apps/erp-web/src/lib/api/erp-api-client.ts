import { env } from "../config/env";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface FetchOptions {
  method?: HttpMethod;
  path: string;
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
  /** Códigos HTTP adicionais tratados como sucesso (ex.: 207, 422 na ingestão). */
  additionalOkStatuses?: number[];
}

export async function erpApiFetch<T>(options: FetchOptions): Promise<T> {
  const { method = "GET", path, body, searchParams, additionalOkStatuses = [] } = options;

  const url = new URL(`${env.erpApiUrl}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.erpApiInternalSecret}`,
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      throw new Error(
        response.ok
          ? `Resposta inválida da API (${response.status}): não é JSON.`
          : rawText.slice(0, 280) || `HTTP ${response.status} (corpo não JSON)`,
      );
    }
  }

  const ok = response.ok || additionalOkStatuses.includes(response.status);

  if (!ok) {
    const d = data as {
      message?: string;
      code?: string;
      issues?: Array<{ path?: (string | number)[]; message?: string }>;
    };
    if (d.code === "VALIDATION_ERROR" && Array.isArray(d.issues) && d.issues.length > 0) {
      const first = d.issues[0]!;
      const path = first.path?.length ? first.path.join(".") : "";
      const detail = [path, first.message].filter(Boolean).join(": ");
      throw new Error(detail || d.message || `HTTP ${response.status}`);
    }
    throw new Error(d.message ?? `HTTP ${response.status}`);
  }

  return data as T;
}
