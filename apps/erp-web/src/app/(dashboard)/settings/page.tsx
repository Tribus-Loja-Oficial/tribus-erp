import { Header } from "@/components/layout/header";

export default function SettingsPage() {
  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Configurações" />
      <div className="p-6">
        <div className="max-w-xl space-y-3 rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          <p>
            Variáveis principais: <code className="rounded bg-zinc-100 px-1">ERP_API_URL</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">ERP_API_INTERNAL_SECRET</code> (mín. 32
            caracteres), <code className="rounded bg-zinc-100 px-1">AUTH_SECRET</code>, credenciais
            admin.
          </p>
          <p>Autenticação CDS/JWT na API pode ser expandida nas próximas iterações.</p>
        </div>
      </div>
    </div>
  );
}
