import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";

interface Row {
  supplier: { id: string; status: string; contactName: string | null };
  party: { legalName: string; tradeName: string | null; email: string | null; documentNumber: string | null };
}

export default async function SuppliersPage() {
  let rows: Row[] = [];
  try {
    const res = await erpApiFetch<{ data: Row[] }>({ path: "/suppliers", searchParams: { limit: 50 } });
    rows = res.data;
  } catch {
    rows = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Fornecedores" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">Fornecedores vinculados a Party.</p>
          <Link
            href="/suppliers/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Novo fornecedor
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Razão social</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    Nenhum fornecedor cadastrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.supplier.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.party.tradeName ?? r.party.legalName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{r.party.documentNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.supplier.contactName ?? r.party.email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-zinc-600">{r.supplier.status}</td>
                    <td className="px-4 py-3">
                      <Link href={`/suppliers/${r.supplier.id}`} className="text-xs text-zinc-500 hover:text-zinc-900 underline">Ver</Link>
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
