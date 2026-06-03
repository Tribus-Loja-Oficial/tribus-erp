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

/** Dados para montar `ProductOperationalForm` (ex.: popup na listagem). */
export async function getProductOperationalEditPayloadAction(
  productId: string,
): Promise<ProductOperationalEditPayload> {
  const [dRes, cRes, colRes, locRes] = await Promise.all([
    erpApiFetch<{
      data: {
        product: Record<string, unknown>;
        compositions?: CompositionRow[];
        costBreakdown?: ProductCostBreakdown | null;
        variants?: VariantApiRow[];
        stockMovements?: ProductStockMovementRow[];
        purchaseReceiptHistory?: ProductPurchaseReceiptHistoryRow[];
        bomParents?: ProductBomParentRow[];
      };
    }>({ path: `/products/${productId}/detail` }),
    erpApiFetch<{ data: { id: string; name: string }[] }>({ path: "/products/categories" }),
    erpApiFetch<{ data: { id: string; name: string }[] }>({ path: "/products/lines" }),
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
    lines: colRes.data ?? [],
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

export async function addLineCompositionAction(lineId: string, body: Record<string, unknown>) {
  await erpApiFetch({
    method: "POST",
    path: `/products/lines/${lineId}/compositions`,
    body,
  });
}

export async function updateLineCompositionAction(
  compositionId: string,
  body: Record<string, unknown>,
) {
  await erpApiFetch({
    method: "PATCH",
    path: `/products/lines/compositions/${compositionId}`,
    body,
  });
}

export async function removeLineCompositionAction(compositionId: string) {
  await erpApiFetch({
    method: "DELETE",
    path: `/products/lines/compositions/${compositionId}`,
  });
}

export async function recalculateProductCostSnapshotAction(productId: string) {
  await erpApiFetch({
    method: "POST",
    path: `/products/${productId}/recalculate-cost`,
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}
