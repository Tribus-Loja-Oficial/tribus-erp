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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qp = parseProductListSearchParams(sp);

  let products: ProductListRow[] = [];
  let meta = { total: 0, page: qp.page, limit: qp.limit };

  try {
    const res = await erpApiFetch<{
      data: ProductListRow[];
      meta?: { total: number; page: number; limit: number };
    }>({
      path: "/products",
      searchParams: productListQueryToApiParams(qp),
    });
    products = res.data ?? [];
    meta = res.meta ?? {
      total: products.length,
      page: qp.page,
      limit: qp.limit ?? DEFAULT_PRODUCT_LIST_LIMIT,
    };
  } catch {
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
      <Suspense fallback={<div className="p-6 text-sm text-zinc-500">A carregar listagem…</div>}>
        <ProductsListing products={products} meta={meta} />
      </Suspense>
    </div>
  );
}
