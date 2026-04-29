import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { importXmlAction } from "@/server/actions";

export default async function XmlImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Importar XML" />
      <div className="p-6">
        <Link href="/documents" className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-900">
          Ver documentos fiscais →
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-zinc-600">
            Cole o conteúdo do XML da NF-e. O arquivo pode ser armazenado no R2 quando configurado no Worker.
          </p>
          <form action={importXmlAction} className="space-y-3">
            <textarea
              name="xmlContent"
              required
              rows={16}
              className="w-full rounded-md border border-zinc-300 p-3 font-mono text-xs"
              placeholder="<?xml version..."
            />
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
              Importar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
