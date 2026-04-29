"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";

export default function NewProductionOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_ERP_API_URL ?? "";
      const res = await fetch(`${apiUrl}/production/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: String(fd.get("productId") ?? "").trim(),
          quantityPlanned: Number(fd.get("quantityPlanned") ?? 1),
          notes: String(fd.get("notes") ?? "").trim() || undefined,
        }),
      });
      const json = (await res.json()) as { data?: { id: string }; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Erro ao criar ordem");
      router.push("/production");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Nova Ordem de Produção" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block font-medium text-zinc-700">ID do produto *</label>
              <input
                name="productId"
                required
                placeholder="ID do produto (ex: prd_abc123)"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-zinc-400">Copie o ID na tela de produtos</p>
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Quantidade planejada *</label>
              <input
                name="quantityPlanned"
                type="number"
                min={1}
                defaultValue={1}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-zinc-700">Observações</label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
                placeholder="Instruções de produção, lote, etc."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-md border border-zinc-300 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-md bg-zinc-900 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? "Criando…" : "Criar ordem"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
