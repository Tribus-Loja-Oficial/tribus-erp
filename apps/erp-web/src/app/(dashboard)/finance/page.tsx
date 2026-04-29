import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";
import { createFinancialEntryAction } from "@/server/actions";

interface Dashboard {
  income: number;
  expense: number;
  balance: number;
  totalBalance: number;
  payables: Record<string, number>;
  receivables: Record<string, number>;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalanceCents: number;
}

interface Coa {
  id: string;
  code: string;
  name: string;
}

interface CostCenter {
  id: string;
  name: string;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  let dashboard: Dashboard | null = null;
  let accounts: Account[] = [];
  let chart: Coa[] = [];
  let costCenters: CostCenter[] = [];
  try {
    const [d, a, c, cc] = await Promise.all([
      erpApiFetch<{ data: Dashboard }>({ path: "/finance/dashboard" }),
      erpApiFetch<{ data: Account[] }>({ path: "/finance/accounts" }),
      erpApiFetch<{ data: Coa[] }>({ path: "/finance/chart-of-accounts" }),
      erpApiFetch<{ data: CostCenter[] }>({ path: "/finance/cost-centers" }),
    ]);
    dashboard = d.data;
    accounts = a.data;
    chart = c.data;
    costCenters = cc.data;
  } catch {
    /* empty */
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Financeiro" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <ErrorBanner message={sp.error} />
        {dashboard && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Receitas (período)", value: formatCurrency(dashboard.income) },
              { label: "Despesas (período)", value: formatCurrency(dashboard.expense) },
              { label: "Saldo contas", value: formatCurrency(dashboard.totalBalance) },
              { label: "Resultado", value: formatCurrency(dashboard.balance) },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">Novo lançamento</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-amber-800">
              Cadastre uma conta financeira em <a className="underline" href="/finance/cash">Caixa</a> antes de lançar.
            </p>
          ) : null}
          <form action={createFinancialEntryAction} className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Conta financeira</label>
              <select name="financialAccountId" required className="w-full rounded-md border border-zinc-300 px-3 py-2" disabled={accounts.length === 0}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Tipo</label>
              <select name="type" className="w-full rounded-md border border-zinc-300 px-3 py-2">
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
                <option value="transfer">Transferência</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Valor (R$)</label>
              <input name="amount" required className="w-full rounded-md border border-zinc-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Data</label>
              <input name="date" type="date" required defaultValue={today} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block font-medium text-zinc-700">Descrição</label>
              <input name="description" required className="w-full rounded-md border border-zinc-300 px-3 py-2" />
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Plano de contas (opcional)</label>
              <select name="categoryId" className="w-full rounded-md border border-zinc-300 px-3 py-2">
                <option value="">—</option>
                {chart.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Centro de custo (opcional)</label>
              <select name="costCenterId" className="w-full rounded-md border border-zinc-300 px-3 py-2">
                <option value="">—</option>
                {costCenters.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={accounts.length === 0}
                className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Registrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
