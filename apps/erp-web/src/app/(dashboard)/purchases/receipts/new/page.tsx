import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ErrorBanner } from "@/components/ui/error-banner";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import { createPurchaseReceiptAction } from "@/server/actions";
import { Select } from "@/components/ui/select";

type RefItem = { id: string; name?: string; legalName?: string; sku?: string };
type Location = { id: string; name: string };

export default async function NewPurchaseReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const [suppliersRes, productsRes, locationsRes] = await Promise.all([
    erpApiFetch<{ data: RefItem[] }>({ path: "/suppliers", searchParams: { limit: 200 } }).catch(
      () => ({ data: [] }),
    ),
    erpApiFetch<{ data: { items: RefItem[] } | RefItem[] }>({
      path: "/products",
      searchParams: { limit: 200 },
    }).catch(() => ({ data: [] })),
    erpApiFetch<{ data: Location[] }>({ path: "/inventory/locations" }).catch(() => ({ data: [] })),
  ]);

  const suppliers = suppliersRes.data;
  const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data.items;
  const locations = locationsRes.data;

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Nova entrada de compra" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Link href="/purchases" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Voltar para compras
        </Link>
        <ErrorBanner message={sp.error} />
        <form
          action={createPurchaseReceiptAction}
          className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:grid-cols-2"
        >
          <input
            name="issueDate"
            type="date"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <Select
            name="locationId"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Local de estoque</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select name="supplierId">
            <option value="">Fornecedor (opcional)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.legalName ?? s.name ?? s.id}
              </option>
            ))}
          </Select>
          <Select
            name="productId"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Componente</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku ? `${p.sku} - ` : ""}
                {p.name ?? p.id}
              </option>
            ))}
          </Select>
          <input
            name="purchaseUnit"
            placeholder="Unidade de compra (ex.: rolo)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="stockUnit"
            placeholder="Unidade de estoque (ex.: cm)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="purchasedQuantity"
            type="number"
            step="0.0001"
            min="0.0001"
            placeholder="Qtd comprada"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="stockQuantity"
            type="number"
            step="0.0001"
            min="0.0001"
            placeholder="Qtd em estoque"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="grossAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Valor bruto (R$)"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="freightAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Frete (R$)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="discountAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Desconto (R$)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="taxAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Impostos (R$)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="otherCostAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Outros custos (R$)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="totalCost"
            type="number"
            step="0.01"
            min="0"
            placeholder="Total (R$, opcional)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="externalRef"
            placeholder="Referência externa"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="documentNumber"
            placeholder="Número do documento"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Registrar entrada
          </button>
        </form>
      </div>
    </div>
  );
}
