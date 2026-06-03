import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";
import { updatePurchaseStatusAction, receivePurchaseOrderAction } from "@/server/actions";
import { notFound } from "next/navigation";
import { Select } from "@/components/ui/select";

interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  receivedQuantity: number;
  productId: string | null;
}

interface PurchaseOrder {
  id: string;
  status: string;
  issueDate: string;
  expectedDate: string | null;
  totalAmountCents: number;
  freightAmountCents: number;
  discountAmountCents: number;
  notes: string | null;
  items: PurchaseItem[];
}

interface Location {
  id: string;
  name: string;
  type: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  ordered: "Pedido",
  partially_received: "Recebido parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

export default async function PurchaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  let order: PurchaseOrder | null = null;
  let locations: Location[] = [];

  try {
    const [o, l] = await Promise.all([
      erpApiFetch<{ data: PurchaseOrder }>({ path: `/purchases/${id}` }),
      erpApiFetch<{ data: Location[] }>({ path: "/inventory/locations" }),
    ]);
    order = o.data;
    locations = l.data;
  } catch {
    notFound();
  }

  if (!order) notFound();

  const canReceive = order.status === "ordered" || order.status === "partially_received";
  const canCancel = order.status === "draft" || order.status === "ordered";

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Ordem de Compra" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Link href="/purchases" className="text-sm text-zinc-600 hover:text-zinc-900">
            ← Compras
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              order.status === "received"
                ? "bg-green-100 text-green-700"
                : order.status === "cancelled"
                  ? "bg-red-100 text-red-700"
                  : order.status === "ordered"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        <ErrorBanner message={sp.error} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-zinc-800">Itens</h2>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="pr-4 pb-2">Descrição</th>
                  <th className="pr-4 pb-2 text-right">Qtd</th>
                  <th className="pr-4 pb-2 text-right">Recebido</th>
                  <th className="pr-4 pb-2 text-right">Unit.</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-50 last:border-0">
                    <td className="py-2 pr-4 text-zinc-900">{item.description}</td>
                    <td className="py-2 pr-4 text-right text-zinc-600 tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      <span
                        className={
                          item.receivedQuantity >= item.quantity
                            ? "text-green-600"
                            : "text-zinc-600"
                        }
                      >
                        {item.receivedQuantity}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-zinc-600 tabular-nums">
                      {formatCurrency(item.unitPriceCents)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatCurrency(item.totalPriceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200">
                  <td colSpan={4} className="pt-3 text-right text-sm font-semibold text-zinc-700">
                    Total
                  </td>
                  <td className="pt-3 text-right font-bold text-zinc-900 tabular-nums">
                    {formatCurrency(order.totalAmountCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-zinc-800">Detalhes</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Emissão</dt>
                  <dd className="text-zinc-900">{order.issueDate}</dd>
                </div>
                {order.expectedDate && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Previsão</dt>
                    <dd className="text-zinc-900">{order.expectedDate}</dd>
                  </div>
                )}
                {order.freightAmountCents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Frete</dt>
                    <dd className="text-zinc-900">{formatCurrency(order.freightAmountCents)}</dd>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <dt className="text-zinc-500">Obs</dt>
                    <dd className="mt-1 text-zinc-700">{order.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {order.status === "draft" && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-zinc-800">Ações</h2>
                <form action={updatePurchaseStatusAction} className="space-y-2">
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="ordered" />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Confirmar pedido
                  </button>
                </form>
              </div>
            )}

            {canReceive && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-zinc-800">Registrar recebimento</h2>
                <form action={receivePurchaseOrderAction} className="space-y-3 text-sm">
                  <input type="hidden" name="id" value={order.id} />
                  <div>
                    <label className="mb-1 block font-medium text-zinc-700">Local de estoque</label>
                    <Select name="locationId" required>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {order.items
                    .filter((i) => i.receivedQuantity < i.quantity)
                    .map((item) => (
                      <div key={item.id} className="rounded-md bg-zinc-50 p-3">
                        <p className="mb-1 font-medium text-zinc-700">{item.description}</p>
                        <p className="mb-2 text-xs text-zinc-500">
                          Pendente: {item.quantity - item.receivedQuantity} de {item.quantity}
                        </p>
                        <input type="hidden" name={`item_id_${item.id}`} value={item.id} />
                        <label className="mb-1 block text-xs text-zinc-600">Qtd recebida</label>
                        <input
                          name={`item_qty_${item.id}`}
                          type="number"
                          min="0"
                          step="0.001"
                          max={item.quantity - item.receivedQuantity}
                          defaultValue={item.quantity - item.receivedQuantity}
                          className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  <button
                    type="submit"
                    className="w-full rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Registrar entrada no estoque
                  </button>
                </form>
              </div>
            )}

            {canCancel && (
              <form action={updatePurchaseStatusAction}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="status" value="cancelled" />
                <button
                  type="submit"
                  className="w-full rounded-md border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Cancelar ordem
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
