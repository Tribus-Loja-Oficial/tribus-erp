import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface ReceiptItem {
  id: string;
  productId: string | null;
  description: string | null;
  purchasedQuantity: number;
  purchaseUnit: string;
  stockQuantity: number;
  stockUnit: string;
  totalCostCents: number;
  unitCostDecimal: number;
}

interface PurchaseReceiptDetail {
  id: string;
  issueDate: string;
  receivedAt: string;
  documentType: string;
  documentNumber: string | null;
  supplierId: string | null;
  notes: string | null;
  items: ReceiptItem[];
}

const DOC_LABELS: Record<string, string> = {
  manual: "Manual",
  nfe_xml: "NF-e (XML)",
  receipt: "Recibo",
  invoice: "Fatura",
  legacy_import: "Importação legada",
};

export default async function PurchaseReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let receipt: PurchaseReceiptDetail | null = null;
  try {
    const res = await erpApiFetch<{ data: PurchaseReceiptDetail }>({
      path: `/purchases/receipts/${id}`,
    });
    receipt = res.data;
  } catch {
    notFound();
  }
  if (!receipt) notFound();

  return (
    <div className="flex flex-col overflow-auto">
      <Header title={`Entrada de compra`} />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/purchases" className="text-zinc-600 underline hover:text-zinc-900">
            ← Compras
          </Link>
          <span className="font-mono text-xs text-zinc-500">{receipt.id}</span>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Emissão</dt>
              <dd className="text-zinc-900">{receipt.issueDate}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Recebido em</dt>
              <dd className="text-zinc-900">{receipt.receivedAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Documento</dt>
              <dd className="text-zinc-900">
                {DOC_LABELS[receipt.documentType] ?? receipt.documentType}
                {receipt.documentNumber ? ` · ${receipt.documentNumber}` : ""}
              </dd>
            </div>
            {receipt.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Observações</dt>
                <dd className="text-zinc-800">{receipt.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Qtd compra</th>
                <th className="px-4 py-3 text-right">Qtd estoque</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Unit. (estoque)</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Nenhum item nesta entrada.
                  </td>
                </tr>
              ) : (
                receipt.items.map((it) => (
                  <tr key={it.id} className="border-b border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">
                        {it.description ?? it.productId ?? "—"}
                      </div>
                      {it.productId ? (
                        <Link
                          href={`/products/${it.productId}`}
                          className="text-xs text-sky-700 underline hover:text-sky-900"
                        >
                          Abrir cadastro
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {it.purchasedQuantity} {it.purchaseUnit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {it.stockQuantity} {it.stockUnit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(it.totalCostCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">
                      R$ {Number(it.unitCostDecimal).toFixed(4)} / {it.stockUnit}
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
