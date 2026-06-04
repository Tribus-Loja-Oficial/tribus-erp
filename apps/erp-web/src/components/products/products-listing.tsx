"use client";

import type { ReactNode } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ProductListMainImage } from "@/components/products/product-list-main-image";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  DEFAULT_PRODUCT_LIST_LIMIT,
  parseProductListSearchParams,
  productListQueryToApiParams,
  type ProductListQuery,
} from "@/lib/products-list-query";
import { ProductQuickEditModal } from "@/components/products/product-quick-edit-modal";
import {
  archiveProductAction,
  archiveProductsBulkAction,
  permanentDeleteProductAction,
  permanentDeleteProductsBulkAction,
  restoreProductAction,
  restoreProductsBulkAction,
} from "@/server/product-list-actions";

export interface ProductListRow {
  id: string;
  sku: string;
  /** Referência humana (ex.: PRD-0001). */
  externalRef?: string;
  name: string;
  internalName?: string | null;
  status: string;
  productType: string;
  /** simple | variable */
  productKind?: string;
  variantCount?: number;
  minEffectiveSaleCents?: number;
  maxEffectiveSaleCents?: number;
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
  mainImageFileId?: string | null;
}

const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "finished_product", label: "Produto final" },
  { value: "raw_material", label: "Matéria-prima" },
  { value: "packaging", label: "Embalagem" },
  { value: "kit", label: "Kit" },
  { value: "bundle", label: "Bundle" },
  { value: "service", label: "Serviço" },
  { value: "consumable", label: "Insumo operacional" },
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

const PRODUCT_KINDS: { value: string; label: string }[] = [
  { value: "", label: "Todas as estruturas" },
  { value: "simple", label: "Simples" },
  { value: "variable", label: "Com variações" },
];

const SORTABLE: { field: string; label: string }[] = [
  { field: "externalRef", label: "Ref" },
  { field: "name", label: "Nome" },
  { field: "type", label: "Tipo" },
  { field: "status", label: "Status" },
  { field: "salePrice", label: "Preço" },
  { field: "stock", label: "Estoque" },
  { field: "updatedAt", label: "Atualizado em" },
  { field: "sku", label: "SKU" },
];

function typeLabel(v: string): string {
  return PRODUCT_TYPES.find((t) => t.value === v)?.label ?? v.replace(/_/g, " ");
}

function statusLabel(v: string): string {
  return STATUSES.find((s) => s.value === v)?.label ?? v;
}

function productKindLabel(k: string | undefined): string {
  if (k === "variable") return "Variável";
  if (k === "simple") return "Simples";
  return "—";
}

function listPriceLabel(p: ProductListRow): string {
  const vk = p.productKind === "variable";
  const vmin = p.minEffectiveSaleCents ?? p.salePriceCents;
  const vmax = p.maxEffectiveSaleCents ?? p.salePriceCents;
  const n = p.variantCount ?? 0;
  if (vk && n > 0 && vmin !== vmax) {
    return `a partir de ${formatCurrency(vmin)}`;
  }
  return formatCurrency(vmin);
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
  const [openRowActionsId, setOpenRowActionsId] = useState<string | null>(null);
  const [quickEdit, setQuickEdit] = useState<{ id: string; name: string } | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<
    | null
    | { type: "archive-one"; id: string; name: string }
    | { type: "restore-one"; id: string; name: string }
    | { type: "permanent-delete"; id: string; name: string; sku: string }
    | { type: "permanent-delete-bulk"; items: { id: string; name: string; sku: string }[] }
    | { type: "archive-bulk" }
    | { type: "restore-bulk" }
  >(null);

  const isArchivedView = qp.status === "archived";

  useEffect(() => {
    if (openRowActionsId == null) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = document.getElementById(`product-row-actions-${openRowActionsId}`);
      if (el && !el.contains(e.target as Node)) setOpenRowActionsId(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [openRowActionsId]);

  const searchParamsKey = searchParams.toString();
  useEffect(() => {
    setOpenRowActionsId(null);
    setQuickEdit(null);
  }, [searchParamsKey]);

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

  async function runPermanentDelete(confirmSku: string) {
    if (!modal || modal.type !== "permanent-delete") return;
    setNotice(null);
    startTransition(async () => {
      try {
        await permanentDeleteProductAction(modal.id, confirmSku);
        setModal(null);
        setSelected(new Set());
        setNotice({ type: "ok", text: "Produto eliminado permanentemente." });
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

  function openBulkPermanentDelete() {
    const rows = Array.from(selected)
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is ProductListRow => p != null);
    if (rows.length !== selected.size) {
      setNotice({
        type: "err",
        text: "Para apagar em lote, todos os produtos selecionados têm de estar visíveis nesta página. Limpe a seleção ou navegue até às linhas em falta.",
      });
      return;
    }
    setModal({
      type: "permanent-delete-bulk",
      items: rows.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    });
  }

  async function runPermanentDeleteBulk() {
    if (!modal || modal.type !== "permanent-delete-bulk") return;
    const payload = modal.items.map((i) => ({ id: i.id, confirmSku: i.sku }));
    setNotice(null);
    startTransition(async () => {
      try {
        await permanentDeleteProductsBulkAction(payload);
        setModal(null);
        setSelected(new Set());
        setNotice({
          type: "ok",
          text: `${payload.length} produto(s) eliminado(s) permanentemente.`,
        });
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

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <div className="min-w-0 sm:col-span-2 md:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Busca</label>
            <input
              type="search"
              defaultValue={qp.q ?? ""}
              id="product-search-input"
              placeholder="Buscar por SKU, nome ou descrição..."
              className="block w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition-[border-color,box-shadow] hover:border-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200/80 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value.trim();
                  replaceQuery({ q: v || undefined });
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Tipo</label>
            <Select
              value={qp.productType ?? ""}
              onChange={(e) => replaceQuery({ productType: e.target.value || undefined, page: 1 })}
            >
              {PRODUCT_TYPES.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Estrutura</label>
            <Select
              value={qp.productKind ?? ""}
              onChange={(e) => replaceQuery({ productKind: e.target.value || undefined, page: 1 })}
            >
              {PRODUCT_KINDS.map((o) => (
                <option key={o.value || "all-k"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Status</label>
            <Select
              value={qp.status ?? ""}
              onChange={(e) => {
                const v = e.target.value || undefined;
                if (v === "archived") {
                  replaceQuery({
                    status: "archived",
                    page: 1,
                    stockFilter: undefined,
                    channel: undefined,
                  });
                } else {
                  replaceQuery({ status: v, page: 1 });
                }
              }}
            >
              {STATUSES.map((o) => (
                <option key={o.value || "all-s"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Estoque</label>
            <Select
              value={qp.stockFilter ?? ""}
              onChange={(e) => replaceQuery({ stockFilter: e.target.value || undefined, page: 1 })}
            >
              {STOCK_FILTERS.map((o) => (
                <option key={o.value || "all-st"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full min-w-0 sm:max-w-xs">
            <label className="mb-1 block text-xs font-medium text-zinc-600">Canal</label>
            <Select
              value={qp.channel ?? ""}
              onChange={(e) => replaceQuery({ channel: e.target.value || undefined, page: 1 })}
            >
              {CHANNELS.map((o) => (
                <option key={o.value || "all-ch"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(
                  "product-search-input",
                ) as HTMLInputElement | null;
                const v = el?.value.trim() ?? "";
                replaceQuery({ q: v || undefined });
              }}
              className="rounded-md bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>

      {someSelected && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-medium text-zinc-800">
            {selected.size} produto(s) selecionado(s)
          </span>
          {isArchivedView ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setModal({ type: "restore-bulk" })}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Restaurar selecionados
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={openBulkPermanentDelete}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Apagar definitivamente
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setModal({ type: "archive-bulk" })}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Arquivar selecionados
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={openBulkPermanentDelete}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Apagar definitivamente
              </button>
            </>
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

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[64rem] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-10" />
            <col className="w-[5.5rem]" />
            <col className="w-24" />
            <col />
            <col className="w-[8.5rem]" />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-24" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-40" />
            <col className="w-28" />
          </colgroup>
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todos visíveis"
                />
              </th>
              <th className="w-10 px-2 py-3" aria-label="Edição rápida" />
              <th className="w-[5.5rem] px-2 py-3 text-xs font-semibold tracking-wide text-zinc-500">
                Imagem
              </th>
              {SORTABLE.map((col) => (
                <Fragment key={col.field}>
                  <th className="px-3 py-3">
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
                  {col.field === "type" ? (
                    <>
                      <th className="px-3 py-3 text-xs font-semibold tracking-wide text-zinc-500">
                        Estrutura
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold tracking-wide text-zinc-500">
                        Variações
                      </th>
                    </>
                  ) : null}
                </Fragment>
              ))}
              <th className="px-3 py-3 whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-12 text-center text-zinc-600">
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
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900"
                        title="Editar em popup"
                        aria-label={`Editar ${p.name} em popup`}
                        onClick={() => setQuickEdit({ id: p.id, name: p.name })}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.75}
                          className="h-4 w-4"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Link
                        href={`/products/${p.id}`}
                        className="inline-block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        aria-label={`Abrir ficha de ${p.name}`}
                      >
                        <ProductListMainImage
                          key={p.mainImageFileId ?? `empty-${p.id}`}
                          mainImageFileId={p.mainImageFileId}
                          name={p.name}
                        />
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-zinc-700 tabular-nums">
                      {p.externalRef ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block min-w-0 truncate font-medium text-zinc-900">
                        {p.name}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-xs text-zinc-600">
                      {typeLabel(p.productType)}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-700">
                      {productKindLabel(p.productKind)}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {p.productKind === "variable" ? `${p.variantCount ?? 0} var.` : "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{statusLabel(p.status)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{listPriceLabel(p)}</td>
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
                    <td className="truncate px-3 py-3 font-mono text-xs" title={p.sku}>
                      {p.sku}
                    </td>
                    <td className="relative px-3 py-3 align-middle whitespace-nowrap">
                      <div id={`product-row-actions-${p.id}`} className="relative inline-block">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
                          aria-expanded={openRowActionsId === p.id}
                          aria-haspopup="menu"
                          aria-controls={`product-row-actions-menu-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenRowActionsId((cur) => (cur === p.id ? null : p.id));
                          }}
                        >
                          Ações
                          <span className="text-zinc-500" aria-hidden>
                            ▾
                          </span>
                        </button>
                        {openRowActionsId === p.id ? (
                          <div
                            id={`product-row-actions-menu-${p.id}`}
                            role="menu"
                            className="absolute top-full right-0 z-30 mt-1 min-w-[11rem] rounded-md border border-zinc-200 bg-white py-1 text-left shadow-lg"
                          >
                            <Link
                              href={`/products/${p.id}`}
                              role="menuitem"
                              className="block px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-50"
                              onClick={() => setOpenRowActionsId(null)}
                            >
                              Ver
                            </Link>
                            <Link
                              href={`/products/${p.id}`}
                              role="menuitem"
                              className="block px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-50"
                              onClick={() => setOpenRowActionsId(null)}
                            >
                              Editar
                            </Link>
                            {isArchivedView ? (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-xs text-emerald-800 hover:bg-emerald-50"
                                  onClick={() => {
                                    setOpenRowActionsId(null);
                                    setModal({ type: "restore-one", id: p.id, name: p.name });
                                  }}
                                >
                                  Restaurar
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setOpenRowActionsId(null);
                                    setModal({
                                      type: "permanent-delete",
                                      id: p.id,
                                      name: p.name,
                                      sku: p.sku,
                                    });
                                  }}
                                >
                                  Apagar definitivamente
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-50"
                                  onClick={() => {
                                    setOpenRowActionsId(null);
                                    setModal({ type: "archive-one", id: p.id, name: p.name });
                                  }}
                                >
                                  Arquivar
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setOpenRowActionsId(null);
                                    setModal({
                                      type: "permanent-delete",
                                      id: p.id,
                                      name: p.name,
                                      sku: p.sku,
                                    });
                                  }}
                                >
                                  Apagar definitivamente
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
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
              <Select
                compact
                value={meta.limit}
                onChange={(e) => replaceQuery({ limit: Number(e.target.value), page: 1 })}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </Select>
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
                O produto deixa de aparecer no catálogo ativo. Pode restaurá-lo ou apagá-lo
                definitivamente a partir da vista <strong>Arquivados</strong>.
              </p>
              <p className="mt-2 text-sm text-zinc-600">{modal.name}</p>
            </>
          }
          confirmLabel="Arquivar"
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
      {modal?.type === "permanent-delete" && (
        <PermanentDeleteModal
          productName={modal.name}
          sku={modal.sku}
          pending={pending}
          onCancel={() => setModal(null)}
          onConfirm={runPermanentDelete}
        />
      )}
      {modal?.type === "permanent-delete-bulk" && (
        <BulkPermanentDeleteModal
          items={modal.items}
          pending={pending}
          onCancel={() => setModal(null)}
          onConfirm={runPermanentDeleteBulk}
        />
      )}
      {modal?.type === "archive-bulk" && (
        <ConfirmModal
          title="Arquivar produtos selecionados?"
          body={
            <>
              <p>
                Os produtos deixam de aparecer no catálogo ativo e passam para Arquivados, onde pode
                restaurar ou apagar definitivamente.
              </p>
              <p className="mt-2 font-medium">Quantidade selecionada: {selected.size}</p>
            </>
          }
          confirmLabel="Arquivar"
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

      <ProductQuickEditModal
        productId={quickEdit?.id ?? null}
        productLabel={quickEdit?.name}
        onClose={() => setQuickEdit(null)}
      />
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

function BulkPermanentDeleteModal({
  items,
  pending,
  onCancel,
  onConfirm,
}: {
  items: { id: string; name: string; sku: string }[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue("");
  }, [items]);

  const canSubmit = value.trim().toUpperCase() === "APAGAR" && items.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xl border border-red-200 bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-red-900">
          Apagar {items.length} produto(s) definitivamente?
        </h3>
        <div className="mt-3 space-y-3 text-sm text-zinc-700">
          <p>
            Esta ação remove os registos na base de dados, movimentos e ordens de produção
            associados, e apaga as imagens no armazenamento. Linhas de pedidos antigos mantêm
            valores, mas deixam de referenciar estes produtos.
          </p>
          <ul className="max-h-48 list-inside list-disc space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 py-2 pr-2 pl-1 text-xs">
            {items.map((it) => (
              <li key={it.id} className="text-zinc-800">
                <span className="font-medium">{it.name}</span>{" "}
                <code className="rounded bg-zinc-200 px-1 font-mono text-zinc-700">{it.sku}</code>
              </li>
            ))}
          </ul>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Escreva <strong className="text-red-800">APAGAR</strong> para confirmar:
            </span>
            <input
              type="text"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
              placeholder="APAGAR"
            />
          </label>
        </div>
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
            disabled={pending || !canSubmit}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            Apagar definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

function PermanentDeleteModal({
  productName,
  sku,
  pending,
  onCancel,
  onConfirm,
}: {
  productName: string;
  sku: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (confirmSku: string) => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue("");
  }, [sku, productName]);

  const canSubmit = value.trim() === sku.trim() && sku.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-red-900">Apagar definitivamente?</h3>
        <div className="mt-3 space-y-3 text-sm text-zinc-700">
          <p>
            Não precisa arquivar antes: esta ação remove logo o produto. Remove o registo na base de
            dados, movimentos e ordens de produção associados, e apaga as imagens no armazenamento.
            Linhas de pedidos e documentos fiscais antigos mantêm valores, mas deixam de referenciar
            este produto.
          </p>
          <p className="font-medium text-zinc-900">{productName}</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Escreva o SKU para confirmar: <code className="rounded bg-zinc-100 px-1">{sku}</code>
            </span>
            <input
              type="text"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
              placeholder={sku}
            />
          </label>
        </div>
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
            onClick={() => onConfirm(value)}
            disabled={pending || !canSubmit}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            Apagar definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}
