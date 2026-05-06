"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductOperationalForm } from "@/components/products/product-operational-form";
import type { ProductOperationalEditPayload } from "@/server/product-operational-actions";
import { getProductOperationalEditPayloadAction } from "@/server/product-operational-actions";

type Props = {
  productId: string | null;
  productLabel?: string;
  onClose: () => void;
};

export function ProductQuickEditModal({ productId, productLabel, onClose }: Props) {
  const [payload, setPayload] = useState<ProductOperationalEditPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const data = await getProductOperationalEditPayloadAction(id);
      setPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o produto.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!productId) {
      setPayload(null);
      setError(null);
      return;
    }
    void load(productId);
  }, [productId, load]);

  useEffect(() => {
    if (!productId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [productId, onClose]);

  useEffect(() => {
    if (!productId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [productId]);

  if (!productId) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-10 sm:pt-14"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-quick-edit-title"
        className="mb-10 flex w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
          <h2
            id="product-quick-edit-title"
            className="truncate text-base font-semibold text-zinc-900"
          >
            Editar produto
            {productLabel ? (
              <span className="ml-2 font-normal text-zinc-600">— {productLabel}</span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Fechar
          </button>
        </div>

        <div className="max-h-[min(78vh,1200px)] min-h-[200px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-600">
              Carregando…
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-700">{error}</div>
          ) : payload ? (
            <ProductOperationalForm
              key={productId}
              mode="edit"
              productId={productId}
              initialProduct={payload.product}
              initialCompositions={payload.compositions}
              costBreakdown={payload.costBreakdown}
              initialVariants={payload.variants}
              categories={payload.categories}
              collections={payload.collections}
              locations={payload.locations}
              initialAuditLogs={payload.auditLogs}
              initialStockMovements={payload.stockMovements}
              initialPurchaseReceiptHistory={payload.purchaseReceiptHistory}
              initialBomParents={payload.bomParents}
              embedded
              onClose={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
