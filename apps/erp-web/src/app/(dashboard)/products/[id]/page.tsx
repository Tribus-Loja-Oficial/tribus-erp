import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";
import { updateProductAction } from "@/server/actions";
import { notFound } from "next/navigation";

interface Product {
  id: string;
  sku: string;
  name: string;
  status: string;
  productType: string;
  description: string | null;
  shortDescription: string | null;
  niche: string | null;
  barcode: string | null;
  ncm: string | null;
  unitOfMeasure: string;
  costPriceCents: number;
  salePriceCents: number;
  currentStock: number;
  minStock: number;
  maxStock: number | null;
  updatedAt: string;
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  let product: Product | null = null;
  try {
    const res = await erpApiFetch<{ data: Product }>({ path: `/products/${id}` });
    product = res.data;
  } catch {
    notFound();
  }

  if (!product) notFound();

  return (
    <div className="flex flex-col overflow-auto">
      <Header title={product.name} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link href="/products" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Produtos
        </Link>
        {sp.success && (
          <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
            {sp.success}
          </div>
        )}
        <ErrorBanner message={sp.error} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-zinc-800">Editar produto</h2>
            <form action={updateProductAction} className="space-y-4 text-sm">
              <input type="hidden" name="id" value={product.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">SKU</label>
                  <input
                    name="sku"
                    defaultValue={product.sku}
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Nome</label>
                  <input
                    name="name"
                    defaultValue={product.name}
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Status</label>
                  <select
                    name="status"
                    defaultValue={product.status}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">
                    Preço de venda (R$)
                  </label>
                  <input
                    name="salePrice"
                    defaultValue={(product.salePriceCents / 100).toFixed(2)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Custo (R$)</label>
                  <input
                    name="costPrice"
                    defaultValue={(product.costPriceCents / 100).toFixed(2)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Estoque mínimo</label>
                  <input
                    name="minStock"
                    type="number"
                    defaultValue={product.minStock}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">NCM</label>
                  <input
                    name="ncm"
                    defaultValue={product.ncm ?? ""}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Código de barras</label>
                  <input
                    name="barcode"
                    defaultValue={product.barcode ?? ""}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Descrição curta</label>
                <input
                  name="shortDescription"
                  defaultValue={product.shortDescription ?? ""}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-6 py-2 font-medium text-white hover:bg-zinc-800"
              >
                Salvar alterações
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Resumo</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Estoque atual</dt>
                <dd
                  className={`font-medium ${product.currentStock <= product.minStock && product.minStock > 0 ? "text-amber-600" : "text-zinc-900"}`}
                >
                  {product.currentStock} {product.unitOfMeasure}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Preço de venda</dt>
                <dd className="font-medium text-zinc-900">
                  {formatCurrency(product.salePriceCents)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Custo</dt>
                <dd className="text-zinc-700">{formatCurrency(product.costPriceCents)}</dd>
              </div>
              {product.salePriceCents > 0 && product.costPriceCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Margem</dt>
                  <dd className="font-medium text-green-600">
                    {(
                      ((product.salePriceCents - product.costPriceCents) / product.salePriceCents) *
                      100
                    ).toFixed(1)}
                    %
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">Tipo</dt>
                <dd className="text-zinc-700 capitalize">
                  {product.productType.replace("_", " ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Atualizado</dt>
                <dd className="text-zinc-500">{product.updatedAt.slice(0, 10)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
