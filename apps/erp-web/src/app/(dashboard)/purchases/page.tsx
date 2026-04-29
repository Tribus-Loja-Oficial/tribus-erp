import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface PurchaseOrder {
  id: string;
  status: string;
  issueDate: string;
  expectedDate: string | null;
  totalAmountCents: number;
  supplierId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  ordered: "Pedido",
  partially_received: "Recebido parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

export default async function PurchasesPage() {
  let orders: PurchaseOrder[] = [];
  try {
    const res = await erpApiFetch<{ data: PurchaseOrder[] }>({
      path: "/purchases",
      searchParams: { limit: 40 },
    });
    orders = res.data;
  } catch {
    orders = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Compras" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">Ordens de compra com fornecedores.</p>
          <Link
            href="/purchases/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Nova ordem de compra
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3">Previsão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    Nenhuma ordem de compra. Crie a primeira.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-zinc-600">{o.issueDate}</td>
                    <td className="px-4 py-3 text-zinc-600">{o.expectedDate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.status === "received" ? "bg-green-100 text-green-700" :
                        o.status === "cancelled" ? "bg-red-100 text-red-700" :
                        o.status === "ordered" ? "bg-blue-100 text-blue-700" :
                        "bg-zinc-100 text-zinc-700"
                      }`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(o.totalAmountCents)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/purchases/${o.id}`} className="text-xs text-zinc-500 hover:text-zinc-900 underline">
                        Ver
                      </Link>
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
