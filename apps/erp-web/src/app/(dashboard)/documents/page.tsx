import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface FiscalDoc {
  id: string;
  type: string;
  accessKey: string | null;
  number: string | null;
  series: string | null;
  issueDate: string;
  totalAmountCents: number;
  status: string;
}

export default async function DocumentsPage() {
  let docs: FiscalDoc[] = [];
  try {
    const res = await erpApiFetch<{ data: FiscalDoc[] }>({ path: "/fiscal", searchParams: { limit: 40 } });
    docs = res.data;
  } catch {
    docs = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Documentos fiscais" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Link href="/fiscal/xml-import" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Importar XML
        </Link>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Chave</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    Nenhum documento. Importe um XML.
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 uppercase">{d.type}</td>
                    <td className="px-4 py-3">
                      {d.number ?? "—"} / {d.series ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{d.issueDate}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(d.totalAmountCents)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                      {d.accessKey ?? "—"}
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
