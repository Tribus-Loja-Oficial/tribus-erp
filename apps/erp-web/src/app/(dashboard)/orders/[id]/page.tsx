import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { updateOrderStatusAction } from "@/server/actions";
import { notFound } from "next/navigation";

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
}

interface OrderPayment {
  id: string;
  method: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  channel: string;
  sourceSystem: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  totalCents: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payments: OrderPayment[];
}

const ORDER_STATUSES = ["draft", "pending_payment", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded"];
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", pending_payment: "Aguard. pagamento", paid: "Pago",
  preparing: "Preparando", shipped: "Enviado", delivered: "Entregue",
  cancelled: "Cancelado", refunded: "Estornado",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  let order: Order | null = null;
  try {
    const res = await erpApiFetch<{ data: Order }>({ path: `/orders/${id}` });
    order = res.data;
  } catch {
    notFound();
  }

  if (!order) notFound();

  return (
    <div className="flex flex-col overflow-auto">
      <Header title={`Pedido ${order.orderNumber}`} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="text-sm text-zinc-600 hover:text-zinc-900">← Pedidos</Link>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          <span className="text-xs text-zinc-400 capitalize">{order.channel}</span>
        </div>
        <ErrorBanner message={sp.error} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-zinc-800">Itens</h2>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 text-xs font-semibold uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Produto</th>
                    <th className="pb-2 pr-4 text-right">Qtd</th>
                    <th className="pb-2 pr-4 text-right">Unit.</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-50 last:border-0">
                      <td className="py-2 pr-4">
                        <p className="font-medium text-zinc-900">{item.name}</p>
                        <p className="font-mono text-xs text-zinc-500">{item.sku}</p>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(item.unitPriceCents)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{formatCurrency(item.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-zinc-200 text-sm">
                  {order.discountTotalCents > 0 && (
                    <tr>
                      <td colSpan={3} className="pt-2 text-right text-zinc-500">Desconto</td>
                      <td className="pt-2 text-right tabular-nums text-zinc-500">-{formatCurrency(order.discountTotalCents)}</td>
                    </tr>
                  )}
                  {order.shippingTotalCents > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right text-zinc-500">Frete</td>
                      <td className="text-right tabular-nums">{formatCurrency(order.shippingTotalCents)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="pt-2 text-right font-semibold text-zinc-700">Total</td>
                    <td className="pt-2 text-right tabular-nums font-bold text-zinc-900">{formatCurrency(order.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {order.payments.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-zinc-800">Pagamentos</h2>
                <ul className="space-y-2 text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="capitalize text-zinc-600">{p.method.replace("_", " ")}</span>
                      <span className={`font-medium ${p.status === "confirmed" ? "text-green-600" : "text-zinc-700"}`}>
                        {formatCurrency(p.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-zinc-800">Informações</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Canal</dt>
                  <dd className="capitalize text-zinc-900">{order.channel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Sistema</dt>
                  <dd className="text-zinc-700">{order.sourceSystem}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Pagamento</dt>
                  <dd className="capitalize text-zinc-700">{order.paymentStatus}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Fulfillment</dt>
                  <dd className="capitalize text-zinc-700">{order.fulfillmentStatus}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Criado em</dt>
                  <dd className="text-zinc-500">{formatDateTime(order.createdAt)}</dd>
                </div>
                {order.notes && (
                  <div>
                    <dt className="text-zinc-500">Obs</dt>
                    <dd className="mt-1 text-zinc-700">{order.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {!["delivered", "cancelled", "refunded"].includes(order.status) && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-zinc-800">Atualizar status</h2>
                <form action={updateOrderStatusAction} className="space-y-2">
                  <input type="hidden" name="id" value={order.id} />
                  <select name="status" defaultValue={order.status} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                    Salvar
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
