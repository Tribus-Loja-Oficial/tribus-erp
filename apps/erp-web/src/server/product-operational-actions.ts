"use server";

import { revalidatePath } from "next/cache";
import { erpApiFetch } from "@/lib/api/erp-api-client";

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
  /** Tipos elegíveis para composição (BOM/embalagem). */
  composeCatalog?: boolean;
}): Promise<CatalogProductSearchRow[]> {
  const searchParams: Record<string, string | number> = {
    limit: opts.limit ?? 40,
  };
  const trimmed = opts.q?.trim();
  if (trimmed) searchParams.q = trimmed;
  if (opts.composeCatalog) searchParams.composeCatalog = 1;

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
