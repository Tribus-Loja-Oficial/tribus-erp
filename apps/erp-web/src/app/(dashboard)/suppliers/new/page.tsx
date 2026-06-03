import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createSupplierAction } from "@/server/actions";
import { Select } from "@/components/ui/select";

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Novo fornecedor" />
      <div className="p-6">
        <Link
          href="/suppliers"
          className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Voltar
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form action={createSupplierAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo</label>
              <Select name="type">
                <option value="company">Pessoa jurídica</option>
                <option value="individual">Pessoa física</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Razão social</label>
              <input name="legalName" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Nome fantasia</label>
              <input name="tradeName" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Tipo documento
                </label>
                <Select name="documentType">
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="unknown">Não informado</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Documento</label>
                <input name="documentNumber" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Inscrição estadual
                </label>
                <input name="stateRegistration" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Contato</label>
                <input name="contactName" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">E-mail</label>
                <input name="email" type="email" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Telefone</label>
                <input name="phone" />
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
