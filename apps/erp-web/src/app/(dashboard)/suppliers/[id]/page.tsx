import Link from "next/link";
import { Header } from "@/components/layout/header";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";

interface SupplierDetail {
  supplier: {
    id: string;
    stateRegistration: string | null;
    municipalRegistration: string | null;
    contactName: string | null;
    website: string | null;
    marketplace: string | null;
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
  };
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: SupplierDetail | null = null;
  try {
    const res = await erpApiFetch<{ data: SupplierDetail }>({ path: `/suppliers/${id}` });
    data = res.data;
  } catch {
    notFound();
  }

  if (!data) notFound();
  const { supplier, party } = data;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title={party.tradeName ?? party.legalName} />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <Link href="/suppliers" className="text-sm text-zinc-600 hover:text-zinc-900">
            ← Fornecedores
          </Link>
          <Link
            href={`/purchases/new?supplierId=${supplier.id}`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Nova ordem de compra
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Dados cadastrais</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Razão social</dt>
                <dd className="font-medium text-zinc-900">{party.legalName}</dd>
              </div>
              {party.tradeName && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Nome fantasia</dt>
                  <dd className="text-zinc-700">{party.tradeName}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">{party.documentType.toUpperCase()}</dt>
                <dd className="font-mono text-zinc-700">{party.documentNumber ?? "—"}</dd>
              </div>
              {supplier.stateRegistration && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">IE</dt>
                  <dd className="font-mono text-zinc-700">{supplier.stateRegistration}</dd>
                </div>
              )}
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
              {supplier.contactName && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Contato</dt>
                  <dd className="text-zinc-700">{supplier.contactName}</dd>
                </div>
              )}
              {supplier.website && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Site</dt>
                  <dd>
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </dd>
                </div>
              )}
              {supplier.marketplace && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Marketplace</dt>
                  <dd className="text-zinc-700">{supplier.marketplace}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">Sistema</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Status</dt>
                <dd className="font-medium text-zinc-900 capitalize">{supplier.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Cadastrado em</dt>
                <dd className="text-zinc-500">{formatDateTime(supplier.createdAt)}</dd>
              </div>
              {supplier.notes && (
                <div>
                  <dt className="mb-1 text-zinc-500">Observações</dt>
                  <dd className="text-zinc-700">{supplier.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
