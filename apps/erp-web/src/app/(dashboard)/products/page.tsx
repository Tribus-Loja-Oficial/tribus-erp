import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: string;
  sku: string;
  name: string;
  status: string;
  salePriceCents: number;
  currentStock: number;
  minStock: number;
}

export default async function ProductsPage() {
  let products: Product[] = [];
  try {
    const res = await erpApiFetch<{ data: Product[] }>({
      path: "/products",
      searchParams: { limit: 50 },
    });
    products = res.data;
  } catch {
    products = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Produtos" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">Cadastro de produtos e preços.</p>
          <Link
            href="/products/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Novo produto
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-right">Estoque</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    Nenhum produto encontrado. Crie o primeiro ou verifique a API.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
                    <td className="px-4 py-3 text-zinc-600 capitalize">{p.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(p.salePriceCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.currentStock}
                      {p.minStock > 0 && p.currentStock <= p.minStock ? (
                        <span className="ml-2 text-xs text-amber-600">(mín. {p.minStock})</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${p.id}`}
                        className="text-xs text-zinc-500 underline hover:text-zinc-900"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
