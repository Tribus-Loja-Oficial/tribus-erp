import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";
import {
  Package,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface FinanceDashboard {
  income: number;
  expense: number;
  balance: number;
  totalBalance: number;
  payables: Record<string, number>;
  receivables: Record<string, number>;
}

async function getDashboardData() {
  try {
    const [finance, lowStock, orders] = await Promise.allSettled([
      erpApiFetch<{ data: FinanceDashboard }>({ path: "/finance/dashboard" }),
      erpApiFetch<{ data: unknown[] }>({ path: "/products/low-stock" }),
      erpApiFetch<{ data: unknown[] }>({ path: "/orders", searchParams: { limit: 5 } }),
    ]);

    return {
      finance: finance.status === "fulfilled" ? finance.value.data : null,
      lowStockCount: lowStock.status === "fulfilled" ? lowStock.value.data.length : 0,
      recentOrders: orders.status === "fulfilled" ? orders.value.data : [],
    };
  } catch {
    return { finance: null, lowStockCount: 0, recentOrders: [] };
  }
}

function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500">{label}</p>
        <div className="rounded-lg bg-zinc-100 p-2">
          <Icon className="h-4 w-4 text-zinc-600" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
      {trend && (
        <div className="mt-1 flex items-center gap-1">
          {trend === "up" ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : trend === "down" ? (
            <TrendingDown className="h-3 w-3 text-red-500" />
          ) : null}
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const { finance, lowStockCount } = await getDashboardData();

  const pendingPayables = finance?.payables["open"] ?? 0;
  const pendingReceivables = finance?.receivables["open"] ?? 0;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Dashboard" />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Receitas (mês)"
            value={finance ? formatCurrency(finance.income) : "—"}
            icon={TrendingUp}
            trend="up"
          />
          <MetricCard
            label="Despesas (mês)"
            value={finance ? formatCurrency(finance.expense) : "—"}
            icon={TrendingDown}
            trend="down"
          />
          <MetricCard
            label="Saldo em Caixa"
            value={finance ? formatCurrency(finance.totalBalance) : "—"}
            icon={DollarSign}
          />
          <MetricCard
            label="Produtos com Estoque Baixo"
            value={String(lowStockCount)}
            icon={AlertTriangle}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">A Pagar</h2>
            <div className="space-y-2">
              {[
                { label: "Em aberto", value: pendingPayables },
                { label: "Vencidas", value: finance?.payables["overdue"] ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{item.label}</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">A Receber</h2>
            <div className="space-y-2">
              {[
                { label: "Em aberto", value: pendingReceivables },
                { label: "Vencidas", value: finance?.receivables["overdue"] ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">{item.label}</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
