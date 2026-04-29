import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { createOrderAction } from "@/server/actions";

interface Row {
  customer: { id: string };
  party: { legalName: string; tradeName: string | null };
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  let customers: Row[] = [];
  try {
    const res = await erpApiFetch<{ data: Row[] }>({
      path: "/customers",
      searchParams: { limit: 100 },
    });
    customers = res.data;
  } catch {
    customers = [];
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Novo pedido manual" />
      <div className="p-6">
        <Link
          href="/orders"
          className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Voltar
        </Link>
        <ErrorBanner message={sp.error} />
        <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form action={createOrderAction} className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Cliente (opcional)</label>
              <select
                name="customerId"
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="">—</option>
                {customers.map((r) => (
                  <option key={r.customer.id} value={r.customer.id}>
                    {r.party.tradeName ?? r.party.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">SKU</label>
              <input
                name="sku"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Descrição do item</label>
              <input
                name="itemName"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Qtd</label>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-zinc-700">Preço unit. (R$)</label>
                <input
                  name="unitPrice"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800"
            >
              Criar pedido
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
