"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  DEFAULT_PRODUCT_LIST_LIMIT,
  parseProductListSearchParams,
  productListQueryToApiParams,
  type ProductListQuery,
} from "@/lib/products-list-query";
import {
  archiveProductAction,
  archiveProductsBulkAction,
  restoreProductAction,
  restoreProductsBulkAction,
} from "@/server/product-list-actions";

export interface ProductListRow {
  id: string;
  sku: string;
  name: string;
  internalName?: string | null;
  status: string;
  productType: string;
  salePriceCents: number;
  currentStock: number;
  minStock: number;
  controlsStock: boolean;
  sellable: boolean;
  availableForEcommerce: boolean;
  availableForPos: boolean;
  availableForEvents: boolean;
  archivedAt?: string | null;
  updatedAt?: string | null;
}

const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "finished_product", label: "Produto final" },
  { value: "raw_material", label: "Matéria-prima" },
  { value: "packaging", label: "Embalagem" },
  { value: "kit", label: "Kit" },
  { value: "bundle", label: "Bundle" },
  { value: "service", label: "Serviço" },
  { value: "consumable", label: "Consumível" },
];

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "archived", label: "Arquivado" },
];

const STOCK_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "in_stock", label: "Com estoque" },
  { value: "out_of_stock", label: "Sem estoque" },
  { value: "below_min", label: "Abaixo do mínimo" },
  { value: "not_controlled", label: "Não controla estoque" },
];

const CHANNELS: { value: string; label: string }[] = [
  { value: "", label: "Todos os canais" },
  { value: "sellable", label: "Disponível para venda" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "pos", label: "PDV" },
  { value: "events", label: "Eventos" },
];

const SORTABLE: { field: string; label: string }[] = [
  { field: "sku", label: "SKU" },
  { field: "name", label: "Nome" },
  { field: "type", label: "Tipo" },
  { field: "status", label: "Status" },
  { field: "salePrice", label: "Preço" },
  { field: "stock", label: "Estoque" },
  { field: "updatedAt", label: "Atualizado em" },
];

function typeLabel(v: string): string {
  return PRODUCT_TYPES.find((t) => t.value === v)?.label ?? v.replace(/_/g, " ");
}

function statusLabel(v: string): string {
  return STATUSES.find((s) => s.value === v)?.label ?? v;
}

function sortIndicator(qp: ProductListQuery, field: string): "" | "↑" | "↓" {
  if (qp.sortField !== field) return "";
  if (qp.sortDir === "asc") return "↑";
  if (qp.sortDir === "desc") return "↓";
  return "";
}

function nextSort(qp: ProductListQuery, field: string): Partial<ProductListQuery> {
  if (qp.sortField !== field) return { sortField: field, sortDir: "asc", page: 1 };
  if (qp.sortDir === "asc") return { sortField: field, sortDir: "desc", page: 1 };
  return { sortField: "", sortDir: "", page: 1 };
}

function toQueryString(q: ProductListQuery): string {
  const p = new URLSearchParams();
  const api = productListQueryToApiParams(q);
  for (const [k, v] of Object.entries(api)) {
    if (v === undefined || v === "") continue;
    if (k === "page" && v === 1) continue;
    if (k === "limit" && v === DEFAULT_PRODUCT_LIST_LIMIT) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function ProductsListing({
  products,
  meta,
}: {
  products: ProductListRow[];
  meta: { total: number; page: number; limit: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qp = useMemo(
    () => parseProductListSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<
    | null
    | { type: "archive-one"; id: string; name: string }
    | { type: "restore-one"; id: string; name: string }
    | { type: "archive-bulk" }
    | { type: "restore-bulk" }
  >(null);

  const isArchivedView = qp.status === "archived";

  const replaceQuery = useCallback(
    (patch: Partial<ProductListQuery>) => {
      let next: ProductListQuery = { ...qp, ...patch };
      if (patch.sortField === "" && patch.sortDir === "") {
        const { sortField: _a, sortDir: _b, ...rest } = next;
        next = rest as ProductListQuery;
      }
      if (patch.page === undefined && Object.keys(patch).some((k) => k !== "page")) {
        next = { ...next, page: 1 };
      }
      router.replace(`${pathname}${toQueryString(next)}`);
      router.refresh();
    },
    [pathname, qp, router],
  );

  const allVisibleIds = products.map((p) => p.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(allVisibleIds));
  }

  function clearFilters() {
    router.replace(pathname);
    router.refresh();
  }

  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  async function runArchiveOne() {
    if (!modal || modal.type !== "archive-one") return;
    setNotice(null);
    startTransition(async () => {
      try {
        await archiveProductAction(modal.id);
        setModal(null);
        setSelected(new Set());
        setNotice({ type: "ok", text: "Produto arquivado com sucesso." });
        router.refresh();
      } catch (e) {
        setNotice({
          type: "err",
          text:
            e instanceof Error ? e.message : "Não foi possível concluir a ação. Tente novamente.",
        });
      }
    });
  }

  async function runRestoreOne() {
    if (!modal || modal.type !== "restore-one") return;
    setNotice(null);
    startTransition(async () => {
      try {
        await restoreProductAction(modal.id);
        setModal(null);
        setSelected(new Set());
        setNotice({ type: "ok", text: "Produto restaurado com sucesso." });
        router.refresh();
      } catch (e) {
        setNotice({
          type: "err",
          text:
            e instanceof Error ? e.message : "Não foi possível concluir a ação. Tente novamente.",
        });
      }
    });
  }

  async function runArchiveBulk() {
    if (!modal || modal.type !== "archive-bulk") return;
    const ids = Array.from(selected);
    setNotice(null);
    startTransition(async () => {
      try {
        await archiveProductsBulkAction(ids);
        setModal(null);
        setSelected(new Set());
        setNotice({ type: "ok", text: "Produtos arquivados com sucesso." });
        router.refresh();
      } catch (e) {
        setNotice({
          type: "err",
          text:
            e instanceof Error ? e.message : "Não foi possível concluir a ação. Tente novamente.",
        });
      }
    });
  }

  async function runRestoreBulk() {
    if (!modal || modal.type !== "restore-bulk") return;
    const ids = Array.from(selected);
    setNotice(null);
    startTransition(async () => {
      try {
        await restoreProductsBulkAction(ids);
        setModal(null);
        setSelected(new Set());
        setNotice({ type: "ok", text: "Produtos restaurados com sucesso." });
        router.refresh();
      } catch (e) {
        setNotice({
          type: "err",
          text:
            e instanceof Error ? e.message : "Não foi possível concluir a ação. Tente novamente.",
        });
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {notice && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-600">Busca</label>
          <input
            type="search"
            defaultValue={qp.q ?? ""}
            id="product-search-input"
            placeholder="Buscar por SKU, nome ou descrição..."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value.trim();
                replaceQuery({ q: v || undefined });
              }
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Tipo</label>
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={qp.productType ?? ""}
            onChange={(e) => replaceQuery({ productType: e.target.value || undefined, page: 1 })}
          >
            {PRODUCT_TYPES.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Status</label>
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={qp.status ?? ""}
            onChange={(e) => replaceQuery({ status: e.target.value || undefined, page: 1 })}
          >
            {STATUSES.map((o) => (
              <option key={o.value || "all-s"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Estoque</label>
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={qp.stockFilter ?? ""}
            onChange={(e) => replaceQuery({ stockFilter: e.target.value || undefined, page: 1 })}
          >
            {STOCK_FILTERS.map((o) => (
              <option key={o.value || "all-st"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Canal</label>
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            value={qp.channel ?? ""}
            onChange={(e) => replaceQuery({ channel: e.target.value || undefined, page: 1 })}
          >
            {CHANNELS.map((o) => (
              <option key={o.value || "all-ch"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          Limpar filtros
        </button>
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("product-search-input") as HTMLInputElement | null;
            const v = el?.value.trim() ?? "";
            replaceQuery({ q: v || undefined });
          }}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Buscar
        </button>
      </div>

      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-medium text-zinc-800">
            {selected.size} produto(s) selecionado(s)
          </span>
          {isArchivedView ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setModal({ type: "restore-bulk" })}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Restaurar selecionados
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setModal({ type: "archive-bulk" })}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Arquivar selecionados
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-zinc-600 underline hover:text-zinc-900"
          >
            Limpar seleção
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todos visíveis"
                />
              </th>
              {SORTABLE.map((col) => (
                <th key={col.field} className="px-3 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold tracking-wide text-zinc-500 hover:text-zinc-800"
                    onClick={() => replaceQuery(nextSort(qp, col.field))}
                  >
                    {col.label}
                    <span className="text-zinc-400 tabular-nums">
                      {sortIndicator(qp, col.field)}
                    </span>
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-600">
                  <p className="font-medium text-zinc-800">Nenhum produto encontrado.</p>
                  <p className="mt-1 text-sm">Ajuste os filtros ou cadastre um novo produto.</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      Limpar filtros
                    </button>
                    <Link
                      href="/products/new"
                      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Novo produto
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const belowMin = p.controlsStock && p.minStock > 0 && p.currentStock <= p.minStock;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80"
                  >
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleRow(p.id)}
                        aria-label={`Selecionar ${p.sku}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-3 font-medium text-zinc-900">{p.name}</td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-xs text-zinc-600">
                      {typeLabel(p.productType)}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{statusLabel(p.status)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatCurrency(p.salePriceCents)}
                    </td>
                    <td className="px-3 py-3 text-right text-zinc-800 tabular-nums">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>
                          {p.currentStock}
                          {p.controlsStock && p.minStock > 0 ? (
                            <span className="text-xs text-zinc-500"> (mín. {p.minStock})</span>
                          ) : null}
                        </span>
                        {belowMin ? (
                          <span className="text-xs font-medium text-amber-700">
                            Abaixo do mínimo
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500 tabular-nums">
                      {p.updatedAt
                        ? new Date(p.updatedAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/products/${p.id}`}
                          className="text-xs text-zinc-600 underline hover:text-zinc-900"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/products/${p.id}`}
                          className="text-xs text-zinc-600 underline hover:text-zinc-900"
                        >
                          Editar
                        </Link>
                        {isArchivedView ? (
                          <button
                            type="button"
                            className="text-xs text-emerald-700 underline hover:text-emerald-900"
                            onClick={() =>
                              setModal({ type: "restore-one", id: p.id, name: p.name })
                            }
                          >
                            Restaurar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-amber-800 underline hover:text-amber-950"
                            onClick={() =>
                              setModal({ type: "archive-one", id: p.id, name: p.name })
                            }
                          >
                            Arquivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
          <p>
            Mostrando {from}–{to} de {meta.total} produto(s)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>Por página</span>
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
                value={meta.limit}
                onChange={(e) => replaceQuery({ limit: Number(e.target.value), page: 1 })}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <button
              type="button"
              disabled={meta.page <= 1 || pending}
              onClick={() => replaceQuery({ page: meta.page - 1 })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="tabular-nums">Página {meta.page}</span>
            <button
              type="button"
              disabled={meta.page * meta.limit >= meta.total || pending}
              onClick={() => replaceQuery({ page: meta.page + 1 })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {modal?.type === "archive-one" && (
        <ConfirmModal
          title="Arquivar produto?"
          body={
            <>
              <p>
                Este produto não aparecerá mais nas listagens padrão, mas o histórico será
                preservado. Você poderá restaurá-lo futuramente.
              </p>
              <p className="mt-2 text-sm text-zinc-600">{modal.name}</p>
            </>
          }
          confirmLabel="Arquivar produto"
          onCancel={() => setModal(null)}
          onConfirm={runArchiveOne}
          pending={pending}
        />
      )}
      {modal?.type === "restore-one" && (
        <ConfirmModal
          title="Restaurar produto?"
          body={<p className="text-sm text-zinc-600">{modal.name}</p>}
          confirmLabel="Restaurar produto"
          onCancel={() => setModal(null)}
          onConfirm={runRestoreOne}
          pending={pending}
        />
      )}
      {modal?.type === "archive-bulk" && (
        <ConfirmModal
          title="Arquivar produtos selecionados?"
          body={
            <>
              <p>
                Os produtos selecionados serão removidos das listagens padrão, mas o histórico será
                preservado.
              </p>
              <p className="mt-2 font-medium">Quantidade selecionada: {selected.size}</p>
            </>
          }
          confirmLabel="Arquivar produtos"
          onCancel={() => setModal(null)}
          onConfirm={runArchiveBulk}
          pending={pending}
        />
      )}
      {modal?.type === "restore-bulk" && (
        <ConfirmModal
          title="Restaurar produtos selecionados?"
          body={
            <>
              <p>Os produtos selecionados voltarão à listagem padrão como rascunho.</p>
              <p className="mt-2 font-medium">Quantidade selecionada: {selected.size}</p>
            </>
          }
          confirmLabel="Restaurar produtos"
          onCancel={() => setModal(null)}
          onConfirm={runRestoreBulk}
          pending={pending}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  pending,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
        <div className="mt-3 text-sm text-zinc-700">{body}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
