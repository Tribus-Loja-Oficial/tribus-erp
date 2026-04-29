import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface DreData {
  period: { from: string; to: string };
  revenue: number;
  expenses: number;
  result: number;
  margin: string;
}

interface CashflowRow {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

interface MarginRow {
  productId: string | null;
  name: string;
  sku: string;
  totalQty: number;
  totalRevenueCents: number;
  totalCostCents: number;
  grossMarginCents: number;
  marginPct: string;
}

interface SalesByChannel {
  period: { from: string; to: string };
  totalOrders: number;
  totalRevenueCents: number;
  byChannel: Record<string, { count: number; totalCents: number }>;
}

interface InventoryValuation {
  totalValueCents: number;
  belowMinStockCount: number;
  rows: Array<{
    id: string;
    sku: string;
    name: string;
    currentStock: number;
    costPriceCents: number;
    totalValueCents: number;
    belowMinStock: boolean;
  }>;
}

async function fetchReports() {
  const [dre, cashflow, margin, salesByChannel, inventory] = await Promise.allSettled([
    erpApiFetch<{ data: DreData }>({ path: "/reports/dre" }),
    erpApiFetch<{ data: { rows: CashflowRow[]; currentBalance: number } }>({ path: "/reports/cashflow" }),
    erpApiFetch<{ data: { period: { from: string; to: string }; rows: MarginRow[] } }>({ path: "/reports/margin" }),
    erpApiFetch<{ data: SalesByChannel }>({ path: "/reports/sales-by-channel" }),
    erpApiFetch<{ data: InventoryValuation }>({ path: "/reports/inventory-valuation" }),
  ]);

  return {
    dre: dre.status === "fulfilled" ? dre.value.data : null,
    cashflow: cashflow.status === "fulfilled" ? cashflow.value.data : null,
    margin: margin.status === "fulfilled" ? margin.value.data : null,
    salesByChannel: salesByChannel.status === "fulfilled" ? salesByChannel.value.data : null,
    inventory: inventory.status === "fulfilled" ? inventory.value.data : null,
  };
}

const CHANNEL_LABELS: Record<string, string> = {
  ecommerce: "E-commerce",
  pos: "PDV",
  manual: "Manual",
  event: "Evento",
  marketplace: "Marketplace",
};

export default async function ReportsPage() {
  const { dre, cashflow, margin, salesByChannel, inventory } = await fetchReports();

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Relatórios" />
      <div className="flex flex-1 flex-col gap-6 p-6">

        {/* DRE */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            DRE — Demonstrativo de Resultado (mês atual)
          </h2>
          {dre ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Receita", value: formatCurrency(dre.revenue), color: "text-green-700" },
                { label: "Despesas", value: formatCurrency(dre.expenses), color: "text-red-600" },
                { label: "Resultado", value: formatCurrency(dre.result), color: dre.result >= 0 ? "text-green-700" : "text-red-600" },
                { label: "Margem", value: `${dre.margin}%`, color: "text-zinc-900" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-zinc-500">{c.label}</p>
                  <p className={`mt-1 text-xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sem dados financeiros no período.</p>
          )}
        </section>

        {/* Fluxo de caixa */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Fluxo de Caixa — Últimos 6 meses
          </h2>
          {cashflow && cashflow.rows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="mb-2 px-4 pt-4 text-sm text-zinc-600">
                Saldo atual em contas:{" "}
                <strong className="text-zinc-900">{formatCurrency(cashflow.currentBalance)}</strong>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Mês</th>
                    <th className="px-4 py-3 text-right">Entradas</th>
                    <th className="px-4 py-3 text-right">Saídas</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {cashflow.rows.map((row) => (
                    <tr key={row.month} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-800">{row.month}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">{formatCurrency(row.income)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatCurrency(row.expense)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.balance >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sem movimentações financeiras.</p>
          )}
        </section>

        {/* Vendas por canal */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Vendas por Canal — Mês atual
          </h2>
          {salesByChannel ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="px-4 pt-4 pb-2 text-sm text-zinc-600">
                Total de pedidos: <strong className="text-zinc-900">{salesByChannel.totalOrders}</strong> ·{" "}
                Receita: <strong className="text-zinc-900">{formatCurrency(salesByChannel.totalRevenueCents)}</strong>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(salesByChannel.byChannel).map(([channel, data]) => (
                    <tr key={channel} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-800">{CHANNEL_LABELS[channel] ?? channel}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{data.count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sem pedidos no período.</p>
          )}
        </section>

        {/* Margem por produto */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Margem por Produto — Mês atual (top 20)
          </h2>
          {margin && margin.rows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3 text-right">Qtd</th>
                    <th className="px-4 py-3 text-right">Receita</th>
                    <th className="px-4 py-3 text-right">CMV</th>
                    <th className="px-4 py-3 text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {margin.rows.slice(0, 20).map((row, i) => (
                    <tr key={`${row.sku}-${i}`} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.sku}</td>
                      <td className="px-4 py-3 text-zinc-800">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.totalQty}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.totalRevenueCents)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">{formatCurrency(row.totalCostCents)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${parseFloat(row.marginPct) >= 30 ? "text-green-700" : parseFloat(row.marginPct) < 10 ? "text-red-600" : "text-amber-600"}`}>
                        {row.marginPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma venda com produto vinculado neste período.</p>
          )}
        </section>

        {/* Estoque valorizado */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Estoque Valorizado
          </h2>
          {inventory ? (
            <div>
              <div className="mb-3 flex gap-6 text-sm text-zinc-600">
                <span>
                  Valor total em estoque:{" "}
                  <strong className="text-zinc-900">{formatCurrency(inventory.totalValueCents)}</strong>
                </span>
                {inventory.belowMinStockCount > 0 && (
                  <span className="text-amber-700">
                    ⚠ {inventory.belowMinStockCount} produto(s) abaixo do mínimo
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3 text-right">Estoque</th>
                      <th className="px-4 py-3 text-right">Custo unit.</th>
                      <th className="px-4 py-3 text-right">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.rows.slice(0, 50).map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-zinc-100 last:border-0 ${row.belowMinStock ? "bg-amber-50" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.sku}</td>
                        <td className="px-4 py-3 text-zinc-800">
                          {row.name}
                          {row.belowMinStock && (
                            <span className="ml-2 text-xs text-amber-600">estoque baixo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.currentStock}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatCurrency(row.costPriceCents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(row.totalValueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sem produtos cadastrados.</p>
          )}
        </section>

      </div>
    </div>
  );
}
