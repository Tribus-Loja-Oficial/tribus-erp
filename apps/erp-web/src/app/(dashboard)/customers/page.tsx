import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";

interface Row {
  customer: {
    id: string;
    origin: string;
    status: string;
    totalOrders: number;
    totalSpentCents: number;
    cdsConsumerId: string | null;
  };
  party: {
    legalName: string;
    tradeName: string | null;
    email: string | null;
    documentNumber: string | null;
  };
}

export default async function CustomersPage() {
  let rows: Row[] = [];
  try {
    const res = await erpApiFetch<{ data: Row[] }>({
      path: "/customers",
      searchParams: { limit: 50 },
    });
    rows = res.data;
  } catch {
    rows = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Clientes" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">
            Perfis de cliente vinculados a Party (integração CDS via cdsConsumerId).
          </p>
          <Link
            href="/customers/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Novo cliente
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">CDS</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.customer.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {r.party.tradeName ?? r.party.legalName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {r.party.documentNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{r.party.email ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 capitalize">{r.customer.origin}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {r.customer.cdsConsumerId ? "Sim" : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(r.customer.totalSpentCents)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${r.customer.id}`}
                        className="text-xs text-zinc-500 underline hover:text-zinc-900"
                      >
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
