import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createProductAction } from "@/server/actions";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Novo produto" />
      <div className="p-6">
        <Link
          href="/products"
          className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Voltar
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form action={createProductAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">SKU</label>
              <input
                name="sku"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="TRIBUS-001"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Nome</label>
              <input
                name="name"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Preço venda (R$)
                </label>
                <input
                  name="salePrice"
                  required
                  defaultValue="0"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Custo (R$)</label>
                <input
                  name="costPrice"
                  defaultValue="0"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Estoque mínimo
                </label>
                <input
                  name="minStock"
                  type="number"
                  min={0}
                  defaultValue={0}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
                <select
                  name="status"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
