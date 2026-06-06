"use server";

import { revalidatePath } from "next/cache";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import type {
  CompositionRow,
  ProductAuditLogRow,
  ProductCostSnapshotRow,
  ProductCostBreakdown,
  ProductStockMovementRow,
  ProductPurchaseReceiptHistoryRow,
  ProductBomParentRow,
} from "@/components/products/product-operational-form";
import type { VariantApiRow } from "@/components/products/product-variants-panel";

export interface ProductOperationalEditPayload {
  product: Record<string, unknown>;
  compositions: CompositionRow[];
  costBreakdown: ProductCostBreakdown | null;
  variants: VariantApiRow[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  auditLogs: ProductAuditLogRow[];
  costSnapshots: ProductCostSnapshotRow[];
  stockMovements: ProductStockMovementRow[];
  purchaseReceiptHistory: ProductPurchaseReceiptHistoryRow[];
  bomParents: ProductBomParentRow[];
}

async function revalidateProductsForLine(lineId: string | undefined | null) {
  const id = lineId?.trim();
  if (!id) return;
  try {
    const res = await erpApiFetch<{ data: string[] }>({
      path: `/products/lines/${id}/product-ids`,
    });
    for (const productId of res.data ?? []) {
      revalidatePath(`/products/${productId}`);
    }
  } catch {
    // Segue com revalidação da listagem mesmo se o endpoint não estiver disponível.
  }
  revalidatePath("/products");
}

async function fetchLinesForProductForm(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await erpApiFetch<{ data: { id: string; name: string }[] }>({
      path: "/products/lines",
    });
    return res.data ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return [];
    }
    console.warn(
      `[products] Linhas indisponíveis (${msg}); formulário segue sem receita de linha.`,
    );
    return [];
  }
}

/** Dados para montar `ProductOperationalForm` (ex.: popup na listagem). */
export async function getProductOperationalEditPayloadAction(
  productId: string,
): Promise<ProductOperationalEditPayload> {
  let dRes: {
    data: {
      product: Record<string, unknown>;
      compositions?: CompositionRow[];
      costBreakdown?: ProductCostBreakdown | null;
      variants?: VariantApiRow[];
      stockMovements?: ProductStockMovementRow[];
      purchaseReceiptHistory?: ProductPurchaseReceiptHistoryRow[];
      bomParents?: ProductBomParentRow[];
    };
  };
  try {
    dRes = await erpApiFetch({
      path: `/products/${productId}/detail`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Não foi possível carregar o produto (${msg}). Se a API já foi actualizada, aplique as migrações D1 0015_rename_collection_to_line e 0016_line_compositions no ambiente de produção.`,
    );
  }

  const [cRes, lines, locRes] = await Promise.all([
    erpApiFetch<{ data: { id: string; name: string }[] }>({ path: "/products/categories" }),
    fetchLinesForProductForm(),
    erpApiFetch<{ data: { id: string; name: string }[] }>({ path: "/inventory/locations" }),
  ]);

  const detail = dRes.data;
  if (!detail?.product) {
    throw new Error("Produto não encontrado.");
  }

  let auditLogs: ProductAuditLogRow[] = [];
  let costSnapshots: ProductCostSnapshotRow[] = [];
  try {
    const aRes = await erpApiFetch<{ data: ProductAuditLogRow[] }>({
      path: `/products/${productId}/audit`,
    });
    auditLogs = aRes.data ?? [];
  } catch {
    auditLogs = [];
  }
  try {
    const sRes = await erpApiFetch<{ data: ProductCostSnapshotRow[] }>({
      path: `/products/${productId}/cost-snapshots`,
    });
    costSnapshots = sRes.data ?? [];
  } catch {
    costSnapshots = [];
  }

  return {
    product: detail.product,
    compositions: detail.compositions ?? [],
    costBreakdown: detail.costBreakdown ?? null,
    variants: detail.variants ?? [],
    categories: cRes.data ?? [],
    lines,
    locations: locRes.data ?? [],
    auditLogs,
    costSnapshots,
    stockMovements: detail.stockMovements ?? [],
    purchaseReceiptHistory: detail.purchaseReceiptHistory ?? [],
    bomParents: detail.bomParents ?? [],
  };
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
  /** Matéria-prima, insumo e embalagem apenas (exclui produto final, kit e bundle). */
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

export async function fetchProductCompositionDetailAction(productId: string): Promise<{
  compositions: CompositionRow[];
  costBreakdown: ProductCostBreakdown | null;
}> {
  const res = await erpApiFetch<{
    data: {
      compositions?: CompositionRow[];
      costBreakdown?: ProductCostBreakdown | null;
    };
  }>({ path: `/products/${productId}/detail` });
  return {
    compositions: res.data.compositions ?? [],
    costBreakdown: res.data.costBreakdown ?? null,
  };
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

export async function addLineCompositionAction(lineId: string, body: Record<string, unknown>) {
  await erpApiFetch({
    method: "POST",
    path: `/products/lines/${lineId}/compositions`,
    body,
  });
  await revalidateProductsForLine(lineId);
}

export async function updateLineCompositionAction(
  compositionId: string,
  body: Record<string, unknown>,
) {
  const res = await erpApiFetch<{ data: { parentLineId?: string } }>({
    method: "PATCH",
    path: `/products/lines/compositions/${compositionId}`,
    body,
  });
  await revalidateProductsForLine(res.data?.parentLineId);
}

export async function removeLineCompositionAction(compositionId: string) {
  const res = await erpApiFetch<{ parentLineId?: string }>({
    method: "DELETE",
    path: `/products/lines/compositions/${compositionId}`,
  });
  await revalidateProductsForLine(res.parentLineId);
}

export async function recalculateProductCostSnapshotAction(productId: string) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${productId}/recalculate-cost`,
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}
