import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  channel: string;
  status: string;
  totalCents: number;
  createdAt: string;
}

export default async function OrdersPage() {
  let orders: Order[] = [];
  try {
    const res = await erpApiFetch<{ data: Order[] }>({ path: "/orders", searchParams: { limit: 40 } });
    orders = res.data;
  } catch {
    orders = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Pedidos" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">Pedidos manuais e integrações (ingestão S2S).</p>
          <Link href="/orders/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Novo pedido
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    Nenhum pedido.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 capitalize text-zinc-600">{o.channel}</td>
                    <td className="px-4 py-3 capitalize text-zinc-600">{o.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(o.totalCents)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="text-xs text-zinc-500 hover:text-zinc-900 underline">Ver</Link>
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
