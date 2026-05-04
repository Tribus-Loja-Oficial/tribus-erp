"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  archiveProductVariantAction,
  createProductVariantAction,
  restoreProductVariantAction,
  updateProductVariantAction,
} from "@/server/product-variant-actions";

export interface VariantApiRow {
  id: string;
  externalRef: string;
  sku: string;
  name: string | null;
  status: string;
  attributes: Record<string, string>;
  salePriceCents: number | null;
  costPriceCents: number | null;
  promotionalPriceCents: number | null;
  eventPriceCents: number | null;
  wholesalePriceCents: number | null;
  controlsStock: boolean;
  currentStock: number;
  minStock: number;
  idealStock: number | null;
  barcode: string | null;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  mainImageFileId: string | null;
  archivedAt: string | null;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function inputToCents(raw: string): number {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function attrsToRows(attrs: Record<string, string>): { key: string; value: string }[] {
  const entries = Object.entries(attrs).filter(([k]) => k.trim());
  return entries.length
    ? entries.map(([key, value]) => ({ key, value }))
    : [{ key: "", value: "" }];
}

function rowsToAttrs(rows: { key: string; value: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    out[k] = r.value.trim();
  }
  return out;
}

export function ProductVariantsPanel({
  productId,
  productKind,
  parentSalePriceCents,
  parentCostPriceCents,
  variants,
}: {
  productId: string;
  productKind: string;
  parentSalePriceCents: number;
  parentCostPriceCents: number;
  variants: VariantApiRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" },
  ]);
  const [salePrice, setSalePrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [eventPrice, setEventPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [controlsStock, setControlsStock] = useState(true);
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [idealStock, setIdealStock] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [mainImageFileId, setMainImageFileId] = useState("");

  const isVariable = productKind === "variable";

  function openNew() {
    setError(null);
    setEditingId("new");
    setSku("");
    setName("");
    setStatus("active");
    setAttrRows([{ key: "", value: "" }]);
    setSalePrice("");
    setCostPrice("");
    setPromoPrice("");
    setEventPrice("");
    setWholesalePrice("");
    setControlsStock(true);
    setCurrentStock("0");
    setMinStock("0");
    setIdealStock("");
    setBarcode("");
    setWeightGrams("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setMainImageFileId("");
  }

  function openEdit(v: VariantApiRow) {
    setError(null);
    setEditingId(v.id);
    setSku(v.sku);
    setName(v.name ?? "");
    setStatus(v.status);
    setAttrRows(attrsToRows(v.attributes));
    setSalePrice(v.salePriceCents != null ? centsToInput(v.salePriceCents) : "");
    setCostPrice(v.costPriceCents != null ? centsToInput(v.costPriceCents) : "");
    setPromoPrice(v.promotionalPriceCents != null ? centsToInput(v.promotionalPriceCents) : "");
    setEventPrice(v.eventPriceCents != null ? centsToInput(v.eventPriceCents) : "");
    setWholesalePrice(v.wholesalePriceCents != null ? centsToInput(v.wholesalePriceCents) : "");
    setControlsStock(Boolean(v.controlsStock));
    setCurrentStock(String(v.currentStock));
    setMinStock(String(v.minStock));
    setIdealStock(v.idealStock != null ? String(v.idealStock) : "");
    setBarcode(v.barcode ?? "");
    setWeightGrams(v.weightGrams != null ? String(v.weightGrams) : "");
    setLengthCm(v.lengthCm != null ? String(v.lengthCm) : "");
    setWidthCm(v.widthCm != null ? String(v.widthCm) : "");
    setHeightCm(v.heightCm != null ? String(v.heightCm) : "");
    setMainImageFileId(v.mainImageFileId ?? "");
  }

  function closeForm() {
    setEditingId(null);
    setError(null);
  }

  const effSaleLabel = useMemo(() => {
    const s = salePrice.trim() ? inputToCents(salePrice) : parentSalePriceCents;
    return formatCurrency(s);
  }, [salePrice, parentSalePriceCents]);

  function buildBody(): Record<string, unknown> {
    const attrs = rowsToAttrs(attrRows);
    const body: Record<string, unknown> = {
      sku: sku.trim(),
      name: name.trim() || null,
      status,
      attributes: attrs,
      controlsStock,
      currentStock: Number.parseInt(currentStock, 10) || 0,
      minStock: Number.parseInt(minStock, 10) || 0,
      idealStock: idealStock.trim() ? Number.parseInt(idealStock, 10) : null,
      barcode: barcode.trim() || null,
      weightGrams: weightGrams.trim() ? Number.parseInt(weightGrams, 10) : null,
      lengthCm: lengthCm.trim() ? Number(lengthCm.replace(",", ".")) : null,
      widthCm: widthCm.trim() ? Number(widthCm.replace(",", ".")) : null,
      heightCm: heightCm.trim() ? Number(heightCm.replace(",", ".")) : null,
      mainImageFileId: mainImageFileId.trim() || null,
    };
    if (salePrice.trim()) body.salePriceCents = inputToCents(salePrice);
    else body.salePriceCents = null;
    if (costPrice.trim()) body.costPriceCents = inputToCents(costPrice);
    else body.costPriceCents = null;
    if (promoPrice.trim()) body.promotionalPriceCents = inputToCents(promoPrice);
    else body.promotionalPriceCents = null;
    if (eventPrice.trim()) body.eventPriceCents = inputToCents(eventPrice);
    else body.eventPriceCents = null;
    if (wholesalePrice.trim()) body.wholesalePriceCents = inputToCents(wholesalePrice);
    else body.wholesalePriceCents = null;
    return body;
  }

  function submit() {
    if (!sku.trim()) {
      setError("SKU é obrigatório.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const body = buildBody();
        if (editingId === "new") {
          await createProductVariantAction(productId, body);
        } else if (editingId) {
          await updateProductVariantAction(productId, editingId, body);
        }
        closeForm();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao guardar variação");
      }
    });
  }

  function archive(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await archiveProductVariantAction(productId, id);
        if (editingId === id) closeForm();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao arquivar");
      }
    });
  }

  function restore(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await restoreProductVariantAction(productId, id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao restaurar");
      }
    });
  }

  if (!isVariable) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Produto simples</p>
        <p className="mt-1">
          Este cadastro não usa variações. Para criar variações, altere a estrutura para{" "}
          <strong>Produto com variações</strong> no separador Geral (com estoque do produto a zero).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          Preço vazio herda do pai ({formatCurrency(parentSalePriceCents)}). Efetivo no formulário:{" "}
          <span className="font-medium text-zinc-900">{effSaleLabel}</span>
        </p>
        <button
          type="button"
          disabled={pending || editingId !== null}
          onClick={openNew}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Nova variação
        </button>
      </div>

      {editingId ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {editingId === "new" ? "Nova variação" : "Editar variação"}
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">SKU *</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Ref</label>
              <input
                readOnly
                value={
                  editingId !== "new"
                    ? (variants.find((v) => v.id === editingId)?.externalRef ?? "")
                    : "— após criar"
                }
                className="w-full cursor-default rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Atributos</label>
              <div className="space-y-2">
                {attrRows.map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <input
                      placeholder="Atributo"
                      value={row.key}
                      onChange={(e) => {
                        const next = [...attrRows];
                        next[i] = { key: e.target.value, value: next[i]?.value ?? "" };
                        setAttrRows(next);
                      }}
                      className="min-w-[120px] flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Valor"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...attrRows];
                        next[i] = { key: next[i]?.key ?? "", value: e.target.value };
                        setAttrRows(next);
                      }}
                      className="min-w-[120px] flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                      onClick={() => setAttrRows(attrRows.filter((_, j) => j !== i))}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs font-medium text-zinc-700 underline"
                  onClick={() => setAttrRows([...attrRows, { key: "", value: "" }])}
                >
                  Adicionar atributo
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Preço venda (vazio = pai)
              </label>
              <input
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder={centsToInput(parentSalePriceCents)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Custo (vazio = pai)
              </label>
              <input
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder={centsToInput(parentCostPriceCents)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Preço promocional
              </label>
              <input
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Preço evento</label>
              <input
                value={eventPrice}
                onChange={(e) => setEventPrice(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Preço atacado</label>
              <input
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="v-ctrl-stock"
                type="checkbox"
                checked={controlsStock}
                onChange={(e) => setControlsStock(e.target.checked)}
              />
              <label htmlFor="v-ctrl-stock" className="text-sm text-zinc-800">
                Controla estoque
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Estoque atual</label>
              <input
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Estoque mínimo</label>
              <input
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Estoque ideal</label>
              <input
                value={idealStock}
                onChange={(e) => setIdealStock(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Código de barras
              </label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Peso (g)</label>
              <input
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">C / L / A (cm)</label>
              <div className="flex gap-2">
                <input
                  value={lengthCm}
                  onChange={(e) => setLengthCm(e.target.value)}
                  placeholder="C"
                  className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
                <input
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="L"
                  className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
                <input
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="A"
                  className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Imagem principal (file id)
              </label>
              <input
                value={mainImageFileId}
                onChange={(e) => setMainImageFileId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={closeForm}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Atributos</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Preço</th>
              <th className="px-3 py-2 text-right">Custo</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Mín.</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-zinc-600">
                  Sem variações ainda. Use <strong>Nova variação</strong>.
                </td>
              </tr>
            ) : (
              variants.map((v) => {
                const effSale = v.salePriceCents ?? parentSalePriceCents;
                const effCost = v.costPriceCents ?? parentCostPriceCents;
                const attrStr = Object.entries(v.attributes)
                  .map(([k, val]) => `${k}: ${val}`)
                  .join(" · ");
                const archived = Boolean(v.archivedAt);
                return (
                  <tr
                    key={v.id}
                    className={archived ? "bg-zinc-100 text-zinc-500" : "border-b border-zinc-100"}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{v.externalRef}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                    <td className="max-w-[140px] truncate px-3 py-2">{v.name || "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-zinc-600">
                      {attrStr || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{v.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(effSale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(effCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.currentStock}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.minStock}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {!archived ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => openEdit(v)}
                              className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => archive(v.id)}
                              className="rounded border border-amber-300 px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-50"
                            >
                              Arquivar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => restore(v.id)}
                            className="rounded border border-emerald-300 px-2 py-0.5 text-xs text-emerald-900 hover:bg-emerald-50"
                          >
                            Restaurar
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
    </div>
  );
}
