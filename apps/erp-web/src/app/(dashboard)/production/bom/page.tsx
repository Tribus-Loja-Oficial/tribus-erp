"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";

export default function BomPage() {
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!productId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_ERP_API_URL ?? "";
      const res = await fetch(`${apiUrl}/production/bom/product/${productId.trim()}`);
      const json = await res.json() as { data?: unknown; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Erro");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col overflow-auto">
      <Header title="Fichas Técnicas (BOM)" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <p className="text-sm text-zinc-600">
          Uma BOM (Bill of Materials) define quais insumos e quantidades são necessários para produzir um produto.
          Ao criar uma ordem de produção, o sistema usa a BOM ativa para reservar os materiais automaticamente.
        </p>

        <div className="mx-auto w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-zinc-800">Consultar BOM de um produto</h2>
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <form onSubmit={handleFetch} className="flex gap-2 text-sm">
            <input
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="ID do produto"
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "…" : "Buscar"}
            </button>
          </form>

          {result !== null && (
            <div className="mt-4">
              <pre className="max-h-96 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Como criar uma BOM:</p>
          <p className="mt-1">
            Use a API <code className="rounded bg-amber-100 px-1">POST /production/bom</code> com o produto, versão e lista de insumos.
            A BOM ativa será usada automaticamente ao criar uma ordem de produção.
          </p>
        </div>
      </div>
    </div>
  );
}
