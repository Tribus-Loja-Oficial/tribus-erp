import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { formatCurrency } from "@/lib/utils";
import { createCashRegisterAction, createFinancialAccountAction, openCashSessionAction, closeCashSessionAction } from "@/server/actions";

interface Register {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

interface Session {
  id: string;
  cashRegisterId: string;
  status: string;
  openedAt: string;
  openingAmountCents: number;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalanceCents: number;
}

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  let registers: Register[] = [];
  let sessions: Session[] = [];
  let accounts: Account[] = [];
  try {
    const [r, s, a] = await Promise.all([
      erpApiFetch<{ data: Register[] }>({ path: "/pos/registers" }),
      erpApiFetch<{ data: Session[] }>({ path: "/pos/sessions", searchParams: { limit: 15 } }),
      erpApiFetch<{ data: Account[] }>({ path: "/finance/accounts" }),
    ]);
    registers = r.data;
    sessions = s.data;
    accounts = a.data;
  } catch {
    /* empty */
  }

  const openSession = sessions.find((x) => x.status === "open");

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Caixa" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link href="/finance" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Financeiro
        </Link>
        <ErrorBanner message={sp.error} />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-800">Contas / carteiras</h2>
            <ul className="space-y-2 text-sm text-zinc-700">
              {accounts.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-zinc-100 py-2 last:border-0">
                  <span>{a.name}</span>
                  <span className="tabular-nums text-zinc-900">{formatCurrency(a.currentBalanceCents)}</span>
                </li>
              ))}
            </ul>
            <form action={createFinancialAccountAction} className="space-y-2 border-t border-zinc-100 pt-4 text-sm">
              <p className="text-xs font-medium text-zinc-500">Nova conta financeira</p>
              <input name="name" required placeholder="Nome" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              <select name="type" className="w-full rounded-md border border-zinc-300 px-3 py-2">
                <option value="cash">Dinheiro / caixa</option>
                <option value="bank">Banco</option>
                <option value="credit_card">Cartão</option>
                <option value="payment_gateway">Gateway</option>
                <option value="marketplace">Marketplace</option>
              </select>
              <input name="institution" placeholder="Instituição (opcional)" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              <input name="openingBalance" placeholder="Saldo inicial R$" defaultValue="0" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                Adicionar conta
              </button>
            </form>
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-800">PDV — caixa físico</h2>
            {openSession ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700">
                  Sessão aberta desde{" "}
                  <span className="font-mono text-xs">
                    {new Date(openSession.openedAt).toLocaleString("pt-BR")}
                  </span>
                </p>
                <p className="text-sm text-zinc-600">
                  Fundo inicial: <strong>{(openSession.openingAmountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                </p>
                <form action={closeCashSessionAction} className="space-y-2 text-sm border-t border-zinc-100 pt-3">
                  <input type="hidden" name="sessionId" value={openSession.id} />
                  <p className="text-xs font-medium text-zinc-500">Fechar sessão</p>
                  <input
                    name="closingAmount"
                    placeholder="Valor contado em caixa (R$)"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    defaultValue="0"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Fechar caixa
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">Nenhuma sessão aberta.</p>
            )}
            <form action={openCashSessionAction} className="space-y-2 text-sm">
              <select name="cashRegisterId" required className="w-full rounded-md border border-zinc-300 px-3 py-2">
                {registers.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
              <input name="openingAmount" placeholder="Fundo de troco (R$)" defaultValue="0" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              <button type="submit" className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800">
                Abrir sessão
              </button>
            </form>
            <form action={createCashRegisterAction} className="space-y-2 border-t border-zinc-100 pt-4 text-sm">
              <p className="text-xs font-medium text-zinc-500">Novo terminal de caixa</p>
              <input name="name" required placeholder="Nome do caixa" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              <input name="location" placeholder="Local" className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              <button type="submit" className="w-full rounded-md border border-zinc-300 py-2 font-medium hover:bg-zinc-50">
                Cadastrar caixa
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
