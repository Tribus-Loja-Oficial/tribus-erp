import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";

interface CustomerDetail {
  customer: {
    id: string;
    cdsConsumerId: string | null;
    origin: string;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
    totalOrders: number;
    totalSpentCents: number;
    notes: string | null;
    status: string;
    createdAt: string;
  };
  party: {
    id: string;
    type: string;
    legalName: string;
    tradeName: string | null;
    documentType: string;
    documentNumber: string | null;
    email: string | null;
    phone: string | null;
    cdsConsumerId: string | null;
  };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: CustomerDetail | null = null;
  try {
    const res = await erpApiFetch<{ data: CustomerDetail }>({ path: `/customers/${id}` });
    data = res.data;
  } catch {
    notFound();
  }

  if (!data) notFound();
  const { customer, party } = data;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title={party.tradeName ?? party.legalName} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link href="/customers" className="text-sm text-zinc-600 hover:text-zinc-900">← Clientes</Link>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Dados cadastrais</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Nome</dt>
                <dd className="font-medium text-zinc-900">{party.legalName}</dd>
              </div>
              {party.tradeName && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Nome fantasia</dt>
                  <dd className="text-zinc-700">{party.tradeName}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">Tipo</dt>
                <dd className="capitalize text-zinc-700">{party.type === "individual" ? "Pessoa física" : "Pessoa jurídica"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">{party.documentType.toUpperCase()}</dt>
                <dd className="font-mono text-zinc-700">{party.documentNumber ?? "—"}</dd>
              </div>
              {party.email && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">E-mail</dt>
                  <dd className="text-zinc-700">{party.email}</dd>
                </div>
              )}
              {party.phone && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Telefone</dt>
                  <dd className="text-zinc-700">{party.phone}</dd>
                </div>
              )}
              {customer.cdsConsumerId && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">CDS ID</dt>
                  <dd className="font-mono text-xs text-zinc-500">{customer.cdsConsumerId}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Histórico de compras</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Total de pedidos</dt>
                <dd className="font-bold text-zinc-900">{customer.totalOrders}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Total gasto</dt>
                <dd className="font-bold text-zinc-900">{formatCurrency(customer.totalSpentCents)}</dd>
              </div>
              {customer.firstPurchaseAt && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Primeira compra</dt>
                  <dd className="text-zinc-700">{customer.firstPurchaseAt.slice(0, 10)}</dd>
                </div>
              )}
              {customer.lastPurchaseAt && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Última compra</dt>
                  <dd className="text-zinc-700">{customer.lastPurchaseAt.slice(0, 10)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">Origem</dt>
                <dd className="capitalize text-zinc-700">{customer.origin}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Status</dt>
                <dd className="capitalize text-zinc-700">{customer.status}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Sistema</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Cadastrado em</dt>
                <dd className="text-zinc-500">{formatDateTime(customer.createdAt)}</dd>
              </div>
              {customer.notes && (
                <div>
                  <dt className="mb-1 text-zinc-500">Observações</dt>
                  <dd className="text-zinc-700">{customer.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
