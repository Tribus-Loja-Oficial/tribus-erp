import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatDateTime } from "@/lib/utils";
import { createStockMovementAction } from "@/server/actions";

interface Location {
  id: string;
  name: string;
  type: string;
}
interface Product {
  id: string;
  sku: string;
  name: string;
}
interface Movement {
  id: string;
  type: string;
  quantity: number;
  createdAt: string;
  productId: string;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  let locations: Location[] = [];
  let products: Product[] = [];
  let movements: Movement[] = [];
  try {
    const [l, p, m] = await Promise.all([
      erpApiFetch<{ data: Location[] }>({ path: "/inventory/locations" }),
      erpApiFetch<{ data: Product[] }>({ path: "/products", searchParams: { limit: 200 } }),
      erpApiFetch<{ data: Movement[] }>({ path: "/inventory/movements", searchParams: { limit: 30 } }),
    ]);
    locations = l.data;
    products = p.data;
    movements = m.data;
  } catch {
    /* empty */
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Estoque" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <ErrorBanner message={sp.error} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Nova movimentação</h2>
            <form action={createStockMovementAction} className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Produto</label>
                <select name="productId" required className="w-full rounded-md border border-zinc-300 px-3 py-2">
                  <option value="">Selecione…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Local</label>
                <select name="locationId" required className="w-full rounded-md border border-zinc-300 px-3 py-2">
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Tipo</label>
                  <select name="type" className="w-full rounded-md border border-zinc-300 px-3 py-2">
                    <option value="purchase">Compra</option>
                    <option value="adjustment">Ajuste</option>
                    <option value="return">Devolução</option>
                    <option value="sale">Venda (baixa)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Quantidade</label>
                  <input name="quantity" type="number" min={1} defaultValue={1} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Custo unitário (R$, opcional)</label>
                <input name="unitCost" className="w-full rounded-md border border-zinc-300 px-3 py-2" placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Observações</label>
                <input name="notes" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800">
                Registrar
              </button>
            </form>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Últimas movimentações</h2>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm text-zinc-700">
              {movements.length === 0 ? (
                <li className="text-zinc-500">Nenhuma movimentação.</li>
              ) : (
                movements.map((mv) => (
                  <li key={mv.id} className="flex justify-between border-b border-zinc-100 py-2 last:border-0">
                    <span>
                      <span className="font-mono text-xs text-zinc-500">{mv.type}</span> · {mv.quantity} un.
                    </span>
                    <span className="text-xs text-zinc-500">{formatDateTime(mv.createdAt)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
