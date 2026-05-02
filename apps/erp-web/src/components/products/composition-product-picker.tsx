"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchProductsCatalogAction,
  type CatalogProductSearchRow,
} from "@/server/product-operational-actions";

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
        placeholder="Digite SKU ou nome…"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        autoComplete="off"
      />
      {value ? (
        <p className="mt-1 text-xs text-zinc-700">
          Selecionado: <span className="font-mono">{displaySku ?? "—"}</span>
          {" — "}
          <span>{displayName ?? value}</span>
          <button
            type="button"
            className="ml-2 text-zinc-500 underline hover:text-zinc-800"
            onClick={() => onChange("")}
          >
            Limpar
          </button>
        </p>
      ) : null}
      {open ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg">
          {loading ? <div className="px-3 py-2 text-xs text-zinc-500">Buscando…</div> : null}
          {!loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">Nenhum resultado.</div>
          ) : null}
          {!loading
            ? results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-50"
                  onClick={() => {
                    onChange(r.id);
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <span className="font-mono text-xs text-zinc-600">{r.sku}</span>
                  <span className="text-zinc-900">{r.name}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
