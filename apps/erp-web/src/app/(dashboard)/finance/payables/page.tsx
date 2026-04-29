import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";
import { createPayableAction, payPayableAction } from "@/server/actions";

interface Payable {
  id: string;
  description: string;
  dueDate: string;
  amountCents: number;
  paidAmountCents: number;
  status: string;
}

interface SupplierRow {
  supplier: { id: string };
  party: { legalName: string; tradeName: string | null };
}

interface FinancialAccount {
  id: string;
  name: string;
  type: string;
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  let rows: Payable[] = [];
  let suppliers: SupplierRow[] = [];
  let accounts: FinancialAccount[] = [];
  try {
    const [p, s, a] = await Promise.all([
      erpApiFetch<{ data: Payable[] }>({ path: "/finance/payables", searchParams: { limit: 40 } }),
      erpApiFetch<{ data: SupplierRow[] }>({ path: "/suppliers", searchParams: { limit: 100 } }),
      erpApiFetch<{ data: FinancialAccount[] }>({ path: "/finance/accounts" }),
    ]);
    rows = p.data;
    suppliers = s.data;
    accounts = a.data;
  } catch {
    /* empty */
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Contas a pagar" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link href="/finance" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Financeiro
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">Nova conta</h2>
          <form action={createPayableAction} className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Fornecedor (opcional)</label>
              <select
                name="supplierId"
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="">—</option>
                {suppliers.map((r) => (
                  <option key={r.supplier.id} value={r.supplier.id}>
                    {r.party.tradeName ?? r.party.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Vencimento</label>
              <input
                name="dueDate"
                type="date"
                required
                defaultValue={today}
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block font-medium text-zinc-700">Descrição</label>
              <input
                name="description"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Valor (R$)</label>
              <input
                name="amount"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                    Nenhuma conta a pagar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3">{r.description}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.dueDate}</td>
                    <td className="px-4 py-3 capitalize">{r.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(r.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      {r.status !== "paid" && r.status !== "cancelled" && accounts.length > 0 && (
                        <form action={payPayableAction} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={r.id} />
                          <input
                            type="hidden"
                            name="amount"
                            value={(r.amountCents / 100).toFixed(2)}
                          />
                          <select
                            name="financialAccountId"
                            className="rounded border border-zinc-300 px-1 py-0.5 text-xs"
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <select
                            name="paymentMethod"
                            className="rounded border border-zinc-300 px-1 py-0.5 text-xs"
                          >
                            <option value="pix">PIX</option>
                            <option value="bank_transfer">TED</option>
                            <option value="cash">Dinheiro</option>
                          </select>
                          <button
                            type="submit"
                            className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700"
                          >
                            Pagar
                          </button>
                        </form>
                      )}
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
