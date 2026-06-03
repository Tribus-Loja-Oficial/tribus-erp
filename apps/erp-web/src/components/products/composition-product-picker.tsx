"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  searchProductsCatalogAction,
  type CatalogProductSearchRow,
} from "@/server/product-operational-actions";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (productId: string) => void;
  excludeProductId?: string;
  selectedSku?: string | null;
  selectedName?: string | null;
};

export function CompositionProductPicker({
  value,
  onChange,
  excludeProductId,
  selectedSku,
  selectedName,
}: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogProductSearchRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchProductsCatalogAction({
        q: q.trim() || undefined,
        excludeId: excludeProductId,
        limit: 40,
        composeCatalog: true,
      })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, excludeProductId]);

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const picked = results.find((r) => r.id === value);
  const displaySku = picked?.sku ?? selectedSku;
  const displayName = picked?.name ?? selectedName;

  return (
    <div ref={wrapRef} className="relative">
      <label className="mb-1 block text-xs text-zinc-600">Buscar produto</label>
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={value ? "Buscar outro produto…" : "Digite SKU ou nome…"}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        autoComplete="off"
      />
      {value ? (
        <div
          className="mt-2 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-emerald-800/80 uppercase">
              Componente selecionado
            </p>
            <p className="mt-1 truncate text-sm leading-snug font-semibold text-zinc-900">
              {displayName ?? "Produto sem nome"}
            </p>
            {displaySku ? (
              <span className="mt-1.5 inline-flex rounded-md bg-white/90 px-2 py-0.5 font-mono text-[11px] text-zinc-700 tabular-nums ring-1 ring-emerald-200/90">
                {displaySku}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-emerald-100/80 hover:text-zinc-800"
            aria-label="Limpar seleção"
            title="Limpar seleção"
            onClick={() => {
              onChange("");
              setQ("");
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
      {open ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg">
          {loading ? <div className="px-3 py-2 text-xs text-zinc-500">Buscando…</div> : null}
          {!loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">Nenhum resultado.</div>
          ) : null}
          {!loading
            ? results.map((r) => {
                const isSelected = r.id === value;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50",
                      isSelected && "bg-emerald-50 hover:bg-emerald-50/90",
                    )}
                    onClick={() => {
                      onChange(r.id);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    {isSelected ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                    ) : (
                      <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs text-zinc-600 tabular-nums">
                        {r.sku}
                      </span>
                      <span className="block text-zinc-900">{r.name}</span>
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}
