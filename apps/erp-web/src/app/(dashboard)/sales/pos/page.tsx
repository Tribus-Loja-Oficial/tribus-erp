import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { createPosSaleAction } from "@/server/actions";

interface Session {
  id: string;
  cashRegisterId: string;
  status: string;
}

interface CustomerRow {
  customer: { id: string };
  party: { legalName: string; tradeName: string | null };
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  let sessions: Session[] = [];
  let customers: CustomerRow[] = [];
  let products: Product[] = [];
  try {
    const [s, c, p] = await Promise.all([
      erpApiFetch<{ data: Session[] }>({ path: "/pos/sessions", searchParams: { limit: 20 } }),
      erpApiFetch<{ data: CustomerRow[] }>({ path: "/customers", searchParams: { limit: 100 } }),
      erpApiFetch<{ data: Product[] }>({ path: "/products", searchParams: { limit: 200 } }),
    ]);
    sessions = s.data;
    customers = c.data;
    products = p.data;
  } catch {
    /* empty */
  }

  const openSessions = sessions.filter((x) => x.status === "open");

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="PDV" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <p className="text-sm text-zinc-600">
          Use{" "}
          <Link className="underline" href="/finance/cash">
            Caixa
          </Link>{" "}
          para abrir sessão antes de vender.
        </p>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-zinc-800">Venda rápida</h2>
          {openSessions.length === 0 ? (
            <p className="text-sm text-amber-700">
              Abra uma sessão de caixa em Financeiro → Caixa.
            </p>
          ) : (
            <form action={createPosSaleAction} className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Sessão</label>
                <select
                  name="cashSessionId"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                >
                  {openSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id.slice(0, 8)}… ({s.cashRegisterId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Cliente (opcional)</label>
                <select
                  name="customerId"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="">Venda direta</option>
                  {customers.map((r) => (
                    <option key={r.customer.id} value={r.customer.id}>
                      {r.party.tradeName ?? r.party.legalName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">
                  Produto (opcional — baixa estoque)
                </label>
                <select
                  name="productId"
                  className="mb-2 w-full rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="">Sem vínculo / serviço</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
                <label className="mb-1 block font-medium text-zinc-700">SKU na nota</label>
                <input
                  name="sku"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Descrição</label>
                <input
                  name="itemName"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Qtd</label>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={1}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Preço (R$)</label>
                  <input
                    name="unitPrice"
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Pagamento</label>
                  <select
                    name="paymentMethod"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="credit_card">Crédito</option>
                    <option value="debit_card">Débito</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-zinc-700">Valor pago (R$)</label>
                  <input
                    name="paymentAmount"
                    required
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800"
              >
                Finalizar venda
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
