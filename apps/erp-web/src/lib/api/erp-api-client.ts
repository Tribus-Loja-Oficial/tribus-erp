import { env } from "../config/env";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface FetchOptions {
  method?: HttpMethod;
  path: string;
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

export async function erpApiFetch<T>(options: FetchOptions): Promise<T> {
  const { method = "GET", path, body, searchParams } = options;

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { message?: string })?.message ?? `HTTP ${response.status}`);
  }

  return data as T;
}
