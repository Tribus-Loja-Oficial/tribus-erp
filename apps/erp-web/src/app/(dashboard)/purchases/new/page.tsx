import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { createPurchaseOrderAction } from "@/server/actions";
import { Select } from "@/components/ui/select";

interface SupplierRow {
  supplier: { id: string };
  party: { legalName: string; tradeName: string | null };
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  let suppliers: SupplierRow[] = [];
  let products: Product[] = [];

  try {
    const [s, p] = await Promise.all([
      erpApiFetch<{ data: SupplierRow[] }>({ path: "/suppliers", searchParams: { limit: 100 } }),
      erpApiFetch<{ data: Product[] }>({ path: "/products", searchParams: { limit: 200 } }),
    ]);
    suppliers = s.data;
    products = p.data;
  } catch {
    /* empty */
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Nova Ordem de Compra" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Link href="/purchases" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Compras
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form action={createPurchaseOrderAction} className="space-y-4 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-zinc-700">
                  Fornecedor (opcional)
                </label>
                <Select name="supplierId">
                  <option value="">—</option>
                  {suppliers.map((r) => (
                    <option key={r.supplier.id} value={r.supplier.id}>
                      {r.party.tradeName ?? r.party.legalName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Data de emissão</label>
                <input name="issueDate" type="date" required defaultValue={today} />
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Previsão de entrega</label>
                <input name="expectedDate" type="date" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Frete (R$)</label>
                <input name="freight" defaultValue="0" />
              </div>
            </div>

            <fieldset className="rounded-lg border border-zinc-200 p-4">
              <legend className="px-1 text-xs font-semibold text-zinc-500">Item do pedido</legend>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block font-medium text-zinc-700">Produto (opcional)</label>
                  <Select name="productId">
                    <option value="">Sem vínculo</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block font-medium text-zinc-700">Descrição do item</label>
                  <input name="itemDescription" required placeholder="Ex: Fio de couro 2mm" />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Quantidade</label>
                  <input
                    name="itemQty"
                    type="number"
                    min="0.001"
                    step="0.001"
                    defaultValue="1"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">
                    Preço unitário (R$)
                  </label>
                  <input name="itemPrice" required placeholder="0.00" />
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Para múltiplos itens, utilize a API diretamente ou edite após criar.
              </p>
            </fieldset>

            <div>
              <label className="mb-1 block font-medium text-zinc-700">Observações</label>
              <textarea name="notes" rows={2} />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800"
            >
              Criar ordem de compra
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
