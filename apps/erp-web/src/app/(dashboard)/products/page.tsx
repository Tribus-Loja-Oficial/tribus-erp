import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ProductsListing, type ProductListRow } from "@/components/products/products-listing";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import {
  DEFAULT_PRODUCT_LIST_LIMIT,
  parseProductListSearchParams,
  productListQueryToApiParams,
} from "@/lib/products-list-query";

/** Garante props serializáveis para o Client Component (evita falhas de RSC em produção). */
function normalizeProductListRow(raw: Record<string, unknown>): ProductListRow {
  return {
    id: String(raw.id ?? ""),
    sku: String(raw.sku ?? ""),
    externalRef: raw.externalRef != null ? String(raw.externalRef) : undefined,
    name: String(raw.name ?? ""),
    internalName: raw.internalName != null ? String(raw.internalName) : null,
    status: String(raw.status ?? "draft"),
    productType: String(raw.productType ?? ""),
    productKind: raw.productKind != null ? String(raw.productKind) : undefined,
    variantCount:
      raw.variantCount != null && Number.isFinite(Number(raw.variantCount))
        ? Number(raw.variantCount)
        : undefined,
    minEffectiveSaleCents:
      raw.minEffectiveSaleCents != null && Number.isFinite(Number(raw.minEffectiveSaleCents))
        ? Number(raw.minEffectiveSaleCents)
        : undefined,
    maxEffectiveSaleCents:
      raw.maxEffectiveSaleCents != null && Number.isFinite(Number(raw.maxEffectiveSaleCents))
        ? Number(raw.maxEffectiveSaleCents)
        : undefined,
    salePriceCents: Number(raw.salePriceCents ?? 0),
    currentStock: Number(raw.currentStock ?? 0),
    minStock: Number(raw.minStock ?? 0),
    controlsStock: Boolean(raw.controlsStock),
    sellable: Boolean(raw.sellable),
    availableForEcommerce: Boolean(raw.availableForEcommerce),
    availableForPos: Boolean(raw.availableForPos),
    availableForEvents: Boolean(raw.availableForEvents),
    archivedAt: raw.archivedAt != null ? String(raw.archivedAt) : null,
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : null,
    mainImageFileId: raw.mainImageFileId != null ? String(raw.mainImageFileId) : null,
  };
}

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qp = parseProductListSearchParams(sp);

  let products: ProductListRow[] = [];
  let meta = { total: 0, page: qp.page, limit: qp.limit };
  let loadError: string | null = null;

  try {
    const res = await erpApiFetch<{
      data: Record<string, unknown>[];
      meta?: { total: number; page: number; limit: number };
    }>({
      path: "/products",
      searchParams: productListQueryToApiParams(qp),
    });
    products = (res.data ?? []).map((row) => normalizeProductListRow(row));
    meta = res.meta ?? {
      total: products.length,
      page: qp.page,
      limit: qp.limit ?? DEFAULT_PRODUCT_LIST_LIMIT,
    };
  } catch (e) {
    console.error("[products] Falha ao carregar listagem:", e);
    loadError =
      e instanceof Error
        ? e.message
        : "Não foi possível carregar a listagem. Tente novamente em instantes.";
    products = [];
    meta = { total: 0, page: qp.page, limit: qp.limit };
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Produtos" />
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 pt-6">
        <p className="text-sm text-zinc-600">
          Listagem operacional — filtros, ordenação e arquivamento.
        </p>
        <Link
          href="/products/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Novo produto
        </Link>
      </div>
      {loadError ? (
        <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      ) : null}
      <Suspense fallback={<div className="p-6 text-sm text-zinc-500">A carregar listagem…</div>}>
        <ProductsListing products={products} meta={meta} />
      </Suspense>
    </div>
  );
}
