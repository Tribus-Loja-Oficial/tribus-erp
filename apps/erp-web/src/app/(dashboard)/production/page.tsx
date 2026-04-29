import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";

interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  quantityPlanned: number;
  quantityProduced: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planejada", color: "text-zinc-600 bg-zinc-100" },
  in_progress: { label: "Em Progresso", color: "text-blue-700 bg-blue-50" },
  completed: { label: "Concluída", color: "text-green-700 bg-green-50" },
  cancelled: { label: "Cancelada", color: "text-red-600 bg-red-50" },
};

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  let orders: ProductionOrder[] = [];
  try {
    const res = await erpApiFetch<{ data: ProductionOrder[] }>({
      path: "/production/orders",
      searchParams: { limit: 50 },
    });
    orders = res.data;
  } catch {
    orders = [];
  }

  const byStatus: Record<string, number> = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Produção" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <ErrorBanner message={sp.error} />
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-xs">
            {Object.entries(STATUS_LABELS).map(([key, val]) => (
              <span key={key} className={`rounded-full px-2 py-0.5 font-medium ${val.color}`}>
                {val.label}: {byStatus[key] ?? 0}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Link
              href="/production/bom"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Fichas técnicas (BOM)
            </Link>
            <Link
              href="/production/new"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Nova ordem
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Planejado</th>
                <th className="px-4 py-3 text-right">Produzido</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Conclusão</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Nenhuma ordem de produção. Crie a primeira.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const s = STATUS_LABELS[o.status] ?? {
                    label: o.status,
                    color: "text-zinc-600 bg-zinc-100",
                  };
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-800">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.quantityPlanned}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.quantityProduced}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {o.startedAt ? new Date(o.startedAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {o.completedAt ? new Date(o.completedAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/production/${o.id}`}
                          className="text-xs text-zinc-500 underline hover:text-zinc-900"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
