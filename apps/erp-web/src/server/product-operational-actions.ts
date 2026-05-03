"use server";

import { revalidatePath } from "next/cache";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { env } from "@/lib/config/env";

export interface UploadedProductMediaRow {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  referenceType: string | null;
  referenceId: string | null;
}

export interface CatalogProductSearchRow {
  id: string;
  sku: string;
  name: string;
  costPriceCents: number;
  productType: string;
}

export async function searchProductsCatalogAction(opts: {
  q?: string;
  excludeId?: string;
  limit?: number;
}): Promise<CatalogProductSearchRow[]> {
  const searchParams: Record<string, string | number> = {
    limit: opts.limit ?? 40,
  };
  const trimmed = opts.q?.trim();
  if (trimmed) searchParams.q = trimmed;

  const res = await erpApiFetch<{ data: CatalogProductSearchRow[] }>({
    path: "/products",
    searchParams,
  });
  const rows = res.data ?? [];
  return opts.excludeId ? rows.filter((p) => p.id !== opts.excludeId) : rows;
}

export async function createProductOperationalAction(body: Record<string, unknown>) {
  const res = await erpApiFetch<{ data: { id: string } }>({
    method: "POST",
    path: "/products",
    body,
  });
  revalidatePath("/products");
  return res.data.id;
}

export async function updateProductOperationalAction(id: string, body: Record<string, unknown>) {
  await erpApiFetch({
    method: "PATCH",
    path: `/products/${id}`,
    body,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export async function addProductCompositionAction(
  productId: string,
  body: Record<string, unknown>,
) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${productId}/compositions`,
    body,
  });
  revalidatePath(`/products/${productId}`);
}

export async function removeProductCompositionAction(productId: string, compositionId: string) {
  await erpApiFetch({
    method: "DELETE",
    path: `/products/${productId}/compositions/${compositionId}`,
  });
  revalidatePath(`/products/${productId}`);
}

export async function updateProductCompositionAction(
  productId: string,
  compositionId: string,
  body: Record<string, unknown>,
) {
  await erpApiFetch({
    method: "PATCH",
    path: `/products/${productId}/compositions/${compositionId}`,
    body,
  });
  revalidatePath(`/products/${productId}`);
}

export async function uploadProductMediaAction(
  formData: FormData,
): Promise<UploadedProductMediaRow> {
  const url = `${env.erpApiUrl}/products/media/upload`;
  const outbound = new FormData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Ficheiro em falta.");
  }
  outbound.append("file", file);
  const productId = formData.get("productId");
  if (typeof productId === "string" && productId.trim()) {
    outbound.append("productId", productId.trim());
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.erpApiInternalSecret}`,
    },
    body: outbound,
  });

  const data = (await res.json()) as { message?: string; data?: UploadedProductMediaRow };
  if (!res.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  if (!data.data) {
    throw new Error("Resposta inválida da API.");
  }
  return data.data;
}
