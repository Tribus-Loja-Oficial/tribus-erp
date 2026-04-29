import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createCustomerAction } from "@/server/actions";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Novo cliente" />
      <div className="p-6">
        <Link
          href="/customers"
          className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Voltar
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form action={createCustomerAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo</label>
              <select
                name="type"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="individual">Pessoa física</option>
                <option value="company">Pessoa jurídica</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Nome legal</label>
              <input
                name="legalName"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Nome fantasia</label>
              <input
                name="tradeName"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Tipo documento
                </label>
                <select
                  name="documentType"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="unknown">Não informado</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Documento</label>
                <input
                  name="documentNumber"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">E-mail</label>
                <input
                  name="email"
                  type="email"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Telefone</label>
                <input
                  name="phone"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Origem</label>
                <select
                  name="origin"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="manual">Manual</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="event">Evento</option>
                  <option value="imported">Importado</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  ID consumidor CDS
                </label>
                <input
                  name="cdsConsumerId"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Salvar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
