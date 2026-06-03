"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import {
  addLineCompositionAction,
  addProductCompositionAction,
  createProductOperationalAction,
  recalculateProductCostSnapshotAction,
  removeLineCompositionAction,
  removeProductCompositionAction,
  updateLineCompositionAction,
  updateProductCompositionAction,
  updateProductOperationalAction,
} from "@/server/product-operational-actions";
import type { UploadedProductMediaRow } from "@/lib/product-media-types";
import { CompositionProductPicker } from "@/components/products/composition-product-picker";
import {
  ProductVariantsPanel,
  type VariantApiRow,
} from "@/components/products/product-variants-panel";

export interface SelectOption {
  id: string;
  name: string;
}

export interface CompositionRow {
  id: string;
  scope?: "line" | "product";
  sourceCompositionId?: string;
  childProductId: string;
  compositionType: string;
  quantity: number;
  quantityUnit?: string | null;
  packagingChannel?: string | null;
  required: boolean;
  isDefault: boolean;
  notes: string | null;
  childSku?: string | null;
  childName?: string | null;
  childProductType?: string | null;
  childCostPriceCents?: number;
  childUnitCostCents?: number;
  lineCostCents?: number;
  childCostSource?: string | null;
  childCostUpdatedAt?: string | null;
  childLastPurchaseDate?: string | null;
  childUnitCostBasis?: "average" | "legacy_cost_price";
  childLegacyCostWarning?: boolean;
  childAverageCostUnit?: string | null;
  childLatestReceiptId?: string | null;
}

export interface ProductStockMovementRow {
  id: string;
  type: string;
  quantity: number;
  unitCostCents: number | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  locationName: string;
}

export interface ProductPurchaseReceiptHistoryRow {
  receiptId: string;
  receivedAt: string;
  issueDate: string;
  documentType: string;
  documentNumber: string | null;
  stockQuantity: number;
  stockUnit: string;
  totalCostCents: number;
  receiptItemId: string;
}

export interface ProductBomParentRow {
  parentProductId: string;
  parentSku: string | null;
  parentName: string | null;
  lineCount: number;
}

export interface ProductCostBreakdown {
  materialCostCents: number;
  packagingOnlineCostCents: number;
  packagingPresentialCostCents: number;
  laborCostCents: number;
  onlineTotalCostCents: number;
  presentialTotalCostCents: number;
}

export interface ProductAuditLogRow {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  createdAt: string;
  beforeJson?: string | null;
  afterJson?: string | null;
}

/** Espelha o que a API grava em `component_costs_json` (snapshots automáticos). */
export interface ProductCostSnapshotComponentLineRow {
  compositionId?: string;
  childProductId?: string;
  childSku?: string | null;
  childName?: string | null;
  childProductType?: string | null;
  compositionType?: string;
  quantity?: number;
  quantityUnit?: string | null;
  packagingChannel?: string | null;
  unitCostBasis?: string;
  unitCost?: number;
  lineTotalCents?: number;
  costSource?: string;
  costUpdatedAt?: string | null;
  lastPurchaseDate?: string | null;
  averageCostUnit?: string | null;
}

export interface ProductCostSnapshotRow {
  id: string;
  snapshotDate: string;
  source: string;
  materialCostCents: number;
  packagingCostCents: number;
  laborCostCents: number;
  totalCostCents: number;
  componentCosts?: ProductCostSnapshotComponentLineRow[];
}

type SnapshotSourceFilter = "all" | ProductCostSnapshotRow["source"];

type TabId =
  | "general"
  | "prices"
  | "stock"
  | "composition"
  | "variants"
  | "fiscal"
  | "logistics"
  | "media"
  | "history";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "Geral" },
  { id: "prices", label: "Preços" },
  { id: "stock", label: "Estoque" },
  { id: "composition", label: "Composição" },
  { id: "variants", label: "Variações" },
  { id: "fiscal", label: "Fiscal" },
  { id: "logistics", label: "Logística" },
  { id: "media", label: "Mídia / Arquivos" },
  { id: "history", label: "Histórico" },
];

/** Embalagem, matéria-prima e consumível: sem composição própria nem preços de venda ao cliente. */
const SUPPLY_CHAIN_PRODUCT_TYPES = new Set(["packaging", "raw_material", "consumable"]);

function isSupplyChainProductType(productType: string): boolean {
  return SUPPLY_CHAIN_PRODUCT_TYPES.has(productType);
}

function visibleTabsForProductType(productType: string): typeof TABS {
  if (isSupplyChainProductType(productType)) {
    return TABS.filter((t) => t.id !== "composition");
  }
  return TABS;
}

const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "finished_product", label: "Produto final (venda ao cliente)" },
  { value: "raw_material", label: "Matéria-prima" },
  { value: "packaging", label: "Embalagem" },
  { value: "kit", label: "Kit (montagem)" },
  { value: "bundle", label: "Bundle (agrupamento)" },
  { value: "service", label: "Serviço" },
  { value: "consumable", label: "Insumo operacional" },
];

const COMPOSITION_TYPES_ADD: { value: string; label: string }[] = [
  { value: "bom", label: "BOM / materiais de produção" },
  { value: "packaging", label: "Embalagem" },
];

const COMPOSITION_TYPES_EDIT: { value: string; label: string }[] = [
  ...COMPOSITION_TYPES_ADD,
  { value: "kit", label: "Kit" },
  { value: "bundle", label: "Bundle" },
  { value: "accessory", label: "Acessório" },
  { value: "included", label: "Incluso" },
];

const UNITS: { value: string; label: string }[] = [
  { value: "unit", label: "Unidade" },
  { value: "pair", label: "Par" },
  { value: "meter", label: "Metro" },
  { value: "gram", label: "Grama" },
  { value: "kg", label: "Quilograma" },
  { value: "liter", label: "Litro" },
  { value: "package", label: "Pacote" },
];

/** Unidades de consumo na composição (uso por peça). */
const COMPOSITION_USAGE_UNITS: { value: string; label: string }[] = [
  ...UNITS,
  { value: "cm", label: "Centímetro (cm)" },
  { value: "mm", label: "Milímetro (mm)" },
  { value: "m", label: "Metro (m)" },
  { value: "g", label: "Grama (g)" },
  { value: "mg", label: "Miligrama (mg)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "unidade", label: "Unidade (unidade)" },
  { value: "folha", label: "Folha" },
  { value: "uso proporcional", label: "Uso proporcional" },
];

/** Rótulo em português para exibição (códigos do cadastro, compras e composição). */
const UNIT_LABEL_PT: Record<string, string> = {
  ...Object.fromEntries(UNITS.map((u) => [u.value, u.label.toLowerCase()])),
  unidade: "unidade",
  unidades: "unidade",
  par: "par",
  pares: "par",
  metro: "metro",
  metros: "metro",
  m: "metro",
  grama: "grama",
  gramas: "grama",
  g: "grama",
  gr: "grama",
  quilograma: "quilograma",
  quilogramas: "quilograma",
  litro: "litro",
  litros: "litro",
  l: "litro",
  pacote: "pacote",
  pacotes: "pacote",
  centimetro: "centímetro",
  centimetros: "centímetro",
  centímetro: "centímetro",
  centímetros: "centímetro",
  cm: "cm",
  milimetro: "milímetro",
  milimetros: "milímetro",
  milímetro: "milímetro",
  milímetros: "milímetro",
  mm: "mm",
};

function unitLabelPt(unit: string | null | undefined): string {
  const raw = unit?.trim();
  if (!raw) return "unidade";
  const mapped = UNIT_LABEL_PT[raw.toLowerCase()];
  return mapped ?? raw;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function inputToCents(raw: string): number {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function pctMargin(saleCents: number, totalCostCents: number | null | undefined): number | null {
  if (saleCents <= 0 || totalCostCents == null) return null;
  return ((saleCents - totalCostCents) / saleCents) * 100;
}

function markup(saleCents: number, totalCostCents: number): number | null {
  if (totalCostCents <= 0) return null;
  return saleCents / totalCostCents;
}

function compositionCostBasisLabel(basis: string | undefined): string {
  switch (basis) {
    case "average":
      return "Custo médio (2 últimas compras)";
    case "legacy_cost_price":
      return "Preço de custo (legado)";
    default:
      return "—";
  }
}

function productCostSourceLabel(src: string | null | undefined): string {
  const s = src ?? "unknown";
  const map: Record<string, string> = {
    purchase_average: "Média de compras",
    legacy_ingestion: "Importação legada",
    manual: "Manual",
    unknown: "Desconhecido",
  };
  return map[s] ?? s;
}

function productTypeLabel(t: string | null | undefined): string {
  const m: Record<string, string> = {
    finished_product: "Produto final",
    raw_material: "Matéria-prima",
    packaging: "Embalagem",
    consumable: "Insumo operacional",
    kit: "Kit",
    bundle: "Bundle",
    service: "Serviço",
  };
  return (t && m[t]) || t || "—";
}

function packagingChannelLabel(ch: string | null | undefined): string {
  if (ch === "online") return "Online";
  if (ch === "presential") return "Presencial";
  return "—";
}

const COMPOSITION_COST_BASE_HEADER_TOOLTIP =
  "Custo normalizado do componente na unidade usada nesta linha, como R$/m, R$/cm, R$/g ou R$/unidade. Vem do custo médio das 2 últimas compras (ponderado por quantidade) ou do custo base legado do cadastro.";

const COMPOSITION_COST_ON_PRODUCT_HEADER_TOOLTIP =
  "Valor deste componente em uma unidade do produto final: uso por peça × custo base.";

const COMPOSITION_LEGACY_COST_TOOLTIP =
  "Custo legado. Este valor veio do cadastro/importação. Registre compras para formar custo médio real.";

const ADD_TO_LINE_BUTTON_HELP =
  "Inclui o componente na receita partilhada da linha. Todos os produtos com a mesma linha (aba Geral) herdam este item na BOM e no custo.";

const ADD_TO_LINE_BUTTON_HELP_DISABLED =
  "Defina a linha na aba Geral para adicionar à receita partilhada. Depois, o componente passará a valer para todos os produtos dessa linha.";

const COMPOSITION_USAGE_PER_PIECE_TOOLTIP =
  "Quantidade deste componente consumida para fabricar uma unidade do produto — o mesmo valor da coluna «Uso por peça» na tabela.";

function formatCompositionQtyPt(quantity: number): string {
  if (!Number.isFinite(quantity)) return String(quantity);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(quantity);
}

/** Unidade após “/” no custo base (sempre singular em português). */
function compositionRateUnitSuffix(quantityUnit: string | null | undefined): string {
  return unitLabelPt(quantityUnit);
}

function compositionUsagePerPieceLabel(
  quantity: number,
  quantityUnit: string | null | undefined,
): string {
  const qStr = formatCompositionQtyPt(quantity);
  const absQ = Math.abs(quantity);
  const raw = quantityUnit?.trim();
  if (!raw) {
    return `${qStr} ${absQ === 1 ? "unidade" : "unidades"}`;
  }
  const uLower = raw.toLowerCase();
  if (uLower === "unidade" || uLower === "unidades") {
    return `${qStr} ${absQ === 1 ? "unidade" : "unidades"}`;
  }
  return `${qStr} ${raw}`;
}

function compositionCostBaseLabel(
  unitCostCents: number | null | undefined,
  quantityUnit: string | null | undefined,
): string {
  return `${formatCurrency(unitCostCents ?? 0)} / ${compositionRateUnitSuffix(quantityUnit)}`;
}

function productCostDisplayUnit(product: Record<string, unknown>): string {
  const avgUnit = String(product.averageCostUnit ?? "").trim();
  if (avgUnit) return compositionRateUnitSuffix(avgUnit);
  return compositionRateUnitSuffix(String(product.unitOfMeasure ?? ""));
}

function productCostBaseInfoTooltip(product: Record<string, unknown>): string {
  const unit = productCostDisplayUnit(product);
  const hasAverage =
    product.averageCostDecimal != null &&
    Number.isFinite(Number(product.averageCostDecimal)) &&
    Number(product.averageCostDecimal) >= 0;

  if (hasAverage) {
    const avg = Number(product.averageCostDecimal).toFixed(4);
    return [
      `Na composição dos produtos finais, o ERP usa R$ ${avg} por ${unit}.`,
      "Esse valor é a média das 2 últimas compras (recebimentos em Compras).",
      "O campo «Custo base» acima só vale se ainda não existir compra registrada.",
    ].join(" ");
  }

  const lines = [
    "Na composição dos produtos finais, o ERP usa este «Custo base» porque ainda não há compras lançadas.",
    "Depois de registrar recebimentos em Compras → Recebimentos, passa a valer a média das 2 últimas compras.",
    `Unidade esperada na composição: ${unit}.`,
  ];
  if (product.costSource === "legacy_ingestion") {
    lines.push("Valor importado de planilha — confirme com uma compra real no sistema.");
  }
  return lines.join(" ");
}

function CompositionColumnHelp({ title }: { title: string }) {
  return (
    <span className="inline-flex cursor-help text-zinc-400" title={title}>
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{title}</span>
    </span>
  );
}

function CompositionUsageUnitSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const options = useMemo(() => {
    const trimmed = value.trim();
    const known = new Set(COMPOSITION_USAGE_UNITS.map((u) => u.value));
    if (trimmed && !known.has(trimmed)) {
      return [{ value: trimmed, label: `${trimmed} (valor atual)` }, ...COMPOSITION_USAGE_UNITS];
    }
    return COMPOSITION_USAGE_UNITS;
  }, [value]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"}
    >
      <option value="">— Selecione —</option>
      {options.map((u) => (
        <option key={u.value} value={u.value}>
          {u.label}
        </option>
      ))}
    </select>
  );
}

const compositionTableTh =
  "whitespace-nowrap px-3 py-2 align-middle text-xs font-semibold text-zinc-600";
const compositionTableThNumeric = `${compositionTableTh} text-right`;
const compositionTableTd = "px-3 py-1.5 align-middle text-sm text-zinc-700";
const compositionTableTdNumeric =
  "px-3 py-1.5 text-right align-middle text-sm whitespace-nowrap tabular-nums text-zinc-800";

function CompositionCalculatedUsageCostHeaderLabel({ className }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-end text-right leading-snug ${className ?? ""}`}>
      <span>Custo calculado</span>
      <span>de uso por peça</span>
    </span>
  );
}

function CompositionCostHeader({ label, tooltip }: { label: ReactNode; tooltip: string }) {
  return (
    <th className={compositionTableThNumeric}>
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        <CompositionColumnHelp title={tooltip} />
      </span>
    </th>
  );
}

function compositionCostSourceDetail(row: CompositionRow): string {
  const parts = [
    compositionCostBasisLabel(row.childUnitCostBasis),
    productCostSourceLabel(row.childCostSource),
  ];
  if (row.childLegacyCostWarning) parts.push(COMPOSITION_LEGACY_COST_TOOLTIP);
  return parts.filter((p) => p && p !== "—").join(" · ");
}

function compositionCostBaseTooltip(row: CompositionRow): string {
  const unit = compositionRateUnitSuffix(row.quantityUnit);
  const parts = [
    `Taxa na unidade desta linha (${unit}): ${compositionCostBaseLabel(row.childUnitCostCents, row.quantityUnit)}.`,
    compositionCostSourceDetail(row),
  ];
  if (row.childAverageCostUnit?.trim()) {
    parts.push(`Unidade do custo médio no cadastro: ${row.childAverageCostUnit.trim()}.`);
  }
  return parts.filter(Boolean).join(" ");
}

function CompositionCostBaseCell({ row }: { row: CompositionRow }) {
  return (
    <td className={compositionTableTdNumeric}>
      <span className="inline-flex items-center justify-end gap-1">
        {compositionCostBaseLabel(row.childUnitCostCents, row.quantityUnit)}
        <CompositionColumnHelp title={compositionCostBaseTooltip(row)} />
      </span>
    </td>
  );
}

function snapshotLineCostBaseTooltip(line: ProductCostSnapshotComponentLineRow): string {
  const unit = compositionRateUnitSuffix(line.quantityUnit);
  const parts = [
    line.unitCost != null
      ? `Taxa na unidade desta linha (${unit}): ${compositionCostBaseLabel(line.unitCost, line.quantityUnit)}.`
      : null,
    compositionCostBasisLabel(line.unitCostBasis),
    productCostSourceLabel(line.costSource),
  ];
  if (line.averageCostUnit?.trim()) {
    parts.push(`Unidade do custo médio: ${line.averageCostUnit.trim()}.`);
  }
  return parts.filter((p) => p && p !== "—").join(" ");
}

function compositionCostSourceChip(row: CompositionRow): {
  label: string;
  warn: boolean;
  title: string;
} {
  if (row.childLegacyCostWarning) {
    return {
      label: "Legado ⚠",
      warn: true,
      title: compositionCostSourceDetail(row),
    };
  }
  switch (row.childUnitCostBasis) {
    case "average":
      return { label: "Médio", warn: false, title: compositionCostSourceDetail(row) };
    case "legacy_cost_price":
      return {
        label: "Legado",
        warn: true,
        title: compositionCostSourceDetail(row),
      };
    default: {
      const src = productCostSourceLabel(row.childCostSource);
      return {
        label: src === "Desconhecido" ? "—" : src,
        warn: false,
        title: compositionCostSourceDetail(row),
      };
    }
  }
}

function CompositionComponentCell({ row }: { row: CompositionRow }) {
  const name = String(row.childName ?? row.childProductId ?? "—");
  const sku = row.childSku?.trim();
  const scopeLabel = row.scope === "line" ? "Linha" : row.scope === "product" ? "Produto" : null;
  return (
    <td className={compositionTableTd}>
      <div className="max-w-[14rem] min-w-0 sm:max-w-[18rem]">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="truncate font-medium text-zinc-900" title={name}>
            {name}
          </div>
          {scopeLabel ? (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                row.scope === "line"
                  ? "border-sky-200 bg-sky-100 text-sky-900"
                  : "border-zinc-200 bg-zinc-100 text-zinc-700",
              )}
            >
              {scopeLabel}
            </span>
          ) : null}
        </div>
        {sku ? (
          <div
            className="mt-0.5 truncate font-mono text-[11px] leading-tight text-zinc-500"
            title={sku}
          >
            {sku}
          </div>
        ) : null}
      </div>
    </td>
  );
}

function CompositionCostSourceCell({ row }: { row: CompositionRow }) {
  const chip = compositionCostSourceChip(row);
  if (chip.label === "—") {
    return (
      <td className={compositionTableTd}>
        <span className="text-zinc-400">—</span>
      </td>
    );
  }
  return (
    <td className={compositionTableTd}>
      <span
        className={cn(
          "inline-flex cursor-help items-center rounded-full border px-2 py-0.5 text-[11px] leading-tight font-medium whitespace-nowrap",
          chip.warn
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-zinc-200 bg-zinc-100 text-zinc-700",
        )}
        title={chip.title}
      >
        {chip.label}
      </span>
    </td>
  );
}

function compositionRowHasExpandableDetails(row: CompositionRow): boolean {
  return Boolean(
    row.notes?.trim() ||
    row.childCostUpdatedAt ||
    row.childLatestReceiptId ||
    row.childUnitCostBasis ||
    row.childCostSource,
  );
}

function CompositionDisplayRows({
  row,
  kind,
  colSpan,
  showNotes,
  expanded,
  onToggleExpand,
  onEdit,
  onRemove,
}: {
  row: CompositionRow;
  kind: "bom" | "packaging";
  colSpan: number;
  showNotes: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const canExpand = compositionRowHasExpandableDetails(row);
  const notes = row.notes?.trim();
  const updatedLabel = row.childCostUpdatedAt
    ? formatDateTime(String(row.childCostUpdatedAt))
    : null;

  return (
    <>
      <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
        <CompositionComponentCell row={row} />
        <td className={`${compositionTableTd} whitespace-nowrap`}>
          {kind === "bom"
            ? productTypeLabel(row.childProductType)
            : packagingChannelLabel(row.packagingChannel)}
        </td>
        <CompositionCostBaseCell row={row} />
        <td className={compositionTableTdNumeric}>
          {compositionUsagePerPieceLabel(row.quantity, row.quantityUnit)}
        </td>
        <td className={`${compositionTableTdNumeric} font-medium text-zinc-900`}>
          {formatCurrency(row.lineCostCents ?? 0)}
        </td>
        <CompositionCostSourceCell row={row} />
        <td
          className={`${compositionTableTd} text-xs whitespace-nowrap text-zinc-600 tabular-nums`}
        >
          {updatedLabel ? (
            <span title={updatedLabel}>{updatedLabel}</span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        <td className={`${compositionTableTd} text-xs whitespace-nowrap`}>
          {row.childLatestReceiptId ? (
            <Link
              href={`/purchases/receipts/${row.childLatestReceiptId}`}
              className="text-sky-700 underline hover:text-sky-900"
              title="Ver última compra/entrada"
            >
              Entrada
            </Link>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </td>
        {showNotes ? (
          <td className={`${compositionTableTd} max-w-[5.5rem] text-xs`}>
            {notes ? (
              <span className="block truncate text-zinc-600" title={notes}>
                {notes}
              </span>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </td>
        ) : null}
        <td className={`${compositionTableTd} w-0 text-right whitespace-nowrap`}>
          <div className="inline-flex items-center gap-1.5">
            {canExpand ? (
              <button
                type="button"
                onClick={onToggleExpand}
                className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                title={expanded ? "Ocultar detalhes" : "Ver detalhes"}
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onEdit}
              className="text-xs text-zinc-600 underline hover:text-zinc-900"
            >
              {row.scope === "line" ? "Editar na linha" : "Editar"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-600 hover:underline"
            >
              Remover
            </button>
          </div>
        </td>
      </tr>
      {expanded && canExpand ? (
        <tr className="border-b border-zinc-100 bg-zinc-50/70">
          <td colSpan={colSpan} className="px-3 py-2 text-xs text-zinc-600">
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="font-medium text-zinc-500">Critério de custo</dt>
                <dd>{compositionCostBasisLabel(row.childUnitCostBasis)}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">Origem no cadastro</dt>
                <dd>{productCostSourceLabel(row.childCostSource)}</dd>
              </div>
              {row.childLegacyCostWarning ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="font-medium text-amber-800">Custo legado</dt>
                  <dd className="text-amber-950">{COMPOSITION_LEGACY_COST_TOOLTIP}</dd>
                </div>
              ) : null}
              {updatedLabel ? (
                <div>
                  <dt className="font-medium text-zinc-500">Atualizado em</dt>
                  <dd className="tabular-nums">{updatedLabel}</dd>
                </div>
              ) : null}
              {row.childLatestReceiptId ? (
                <div>
                  <dt className="font-medium text-zinc-500">Última compra/entrada</dt>
                  <dd>
                    <Link
                      href={`/purchases/receipts/${row.childLatestReceiptId}`}
                      className="text-sky-700 underline hover:text-sky-900"
                    >
                      Abrir entrada
                    </Link>
                  </dd>
                </div>
              ) : null}
              {notes ? (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-500">Notas</dt>
                  <dd className="text-zinc-700">{notes}</dd>
                </div>
              ) : null}
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CompositionLegacyCostBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950">
      {count === 1 ? "1 componente usa custo legado." : `${count} componentes usam custo legado.`}{" "}
      Passe o cursor sobre o chip «Legado» na coluna Fonte do custo para ver o detalhe. Registre
      compras para atualizar o custo médio dos materiais.
    </p>
  );
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: "Compra / entrada",
  sale: "Venda",
  return: "Devolução",
  adjustment: "Ajuste",
  production_in: "Produção (entrada)",
  production_out: "Produção (saída)",
  transfer_in: "Transferência (entrada)",
  transfer_out: "Transferência (saída)",
  damaged: "Avaria",
  reservation: "Reserva",
  release_reservation: "Liberação de reserva",
};

function parseGalleryFileIdsFromProduct(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr))
        return arr.filter((x): x is string => typeof x === "string").join("\n");
    } catch {
      return "";
    }
  }
  return "";
}

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGE_SLOTS = 100;

import { isPreviewableProductFileId, productFilePreviewSrc } from "@/lib/product-file-preview";
function parseGalleryFileIdLines(text: string): string[] {
  return text
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Campos numéricos inteiros ≥ 0 no schema da API; arredonda decimais vindos de `<input type="number">`. */
function nonNegativeIntFromInput(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Math.round(Number(t.replace(",", ".")));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

interface ProductOperationalFormProps {
  mode: "new" | "edit";
  productId?: string;
  initialProduct: Record<string, unknown>;
  initialCompositions?: CompositionRow[];
  initialVariants?: VariantApiRow[];
  costBreakdown?: ProductCostBreakdown | null;
  categories: SelectOption[];
  lines: SelectOption[];
  locations: SelectOption[];
  initialAuditLogs?: ProductAuditLogRow[];
  initialCostSnapshots?: ProductCostSnapshotRow[];
  snapshotSourceFilter?: SnapshotSourceFilter;
  snapshotDateFrom?: string;
  snapshotDateTo?: string;
  snapshotPage?: number;
  snapshotLimit?: number;
  snapshotTotal?: number;
  initialStockMovements?: ProductStockMovementRow[];
  initialPurchaseReceiptHistory?: ProductPurchaseReceiptHistoryRow[];
  initialBomParents?: ProductBomParentRow[];
  /** Quando true: layout compacto, sem breadcrumb; Cancelar / «voltar» chamam `onClose`. */
  embedded?: boolean;
  onClose?: () => void;
}

export function ProductOperationalForm({
  mode,
  productId,
  initialProduct,
  initialCompositions = [],
  initialVariants = [],
  costBreakdown,
  categories,
  lines,
  locations,
  initialAuditLogs = [],
  initialCostSnapshots = [],
  snapshotSourceFilter = "all",
  snapshotDateFrom = "",
  snapshotDateTo = "",
  snapshotPage = 1,
  snapshotLimit = 10,
  snapshotTotal = 0,
  initialStockMovements = [],
  initialPurchaseReceiptHistory = [],
  initialBomParents = [],
  embedded = false,
  onClose,
}: ProductOperationalFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("general");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  const mainImageFileInputRef = useRef<HTMLInputElement>(null);
  const galleryImageFileInputRef = useRef<HTMLInputElement>(null);
  const [mediaUploadKind, setMediaUploadKind] = useState<"main" | "gallery" | null>(null);

  const [sku, setSku] = useState(String(initialProduct.sku ?? ""));
  const [name, setName] = useState(String(initialProduct.name ?? ""));
  const [internalName, setInternalName] = useState(String(initialProduct.internalName ?? ""));
  const [productType, setProductType] = useState(
    String(initialProduct.productType ?? "finished_product"),
  );
  const [productKind, setProductKind] = useState(
    String(initialProduct.productKind ?? "simple") as "simple" | "variable",
  );
  const [status, setStatus] = useState(String(initialProduct.status ?? "draft"));
  const [categoryId, setCategoryId] = useState(String(initialProduct.categoryId ?? ""));
  const [lineId, setLineId] = useState(String(initialProduct.lineId ?? ""));
  const [niche, setNiche] = useState(String(initialProduct.niche ?? ""));
  const [brand, setBrand] = useState(String(initialProduct.brand ?? ""));
  const [shortDescription, setShortDescription] = useState(
    String(initialProduct.shortDescription ?? ""),
  );
  const [internalDescription, setInternalDescription] = useState(
    String(initialProduct.internalDescription ?? ""),
  );
  const [description, setDescription] = useState(String(initialProduct.description ?? ""));

  const [salePrice, setSalePrice] = useState(
    centsToInput(Number(initialProduct.salePriceCents ?? 0)),
  );
  const [costPrice, setCostPrice] = useState(
    centsToInput(Number(initialProduct.costPriceCents ?? 0)),
  );
  const [promotionalPrice, setPromotionalPrice] = useState(
    initialProduct.promotionalPriceCents != null
      ? centsToInput(Number(initialProduct.promotionalPriceCents))
      : "",
  );
  const [eventPrice, setEventPrice] = useState(
    initialProduct.eventPriceCents != null
      ? centsToInput(Number(initialProduct.eventPriceCents))
      : "",
  );
  const [wholesalePrice, setWholesalePrice] = useState(
    initialProduct.wholesalePriceCents != null
      ? centsToInput(Number(initialProduct.wholesalePriceCents))
      : "",
  );
  const [compareAtPrice, setCompareAtPrice] = useState(
    initialProduct.compareAtPriceCents != null
      ? centsToInput(Number(initialProduct.compareAtPriceCents))
      : "",
  );

  const [controlsStock, setControlsStock] = useState(
    initialProduct.controlsStock !== undefined ? Boolean(initialProduct.controlsStock) : true,
  );
  const [minStock, setMinStock] = useState(String(initialProduct.minStock ?? 0));
  const [idealStock, setIdealStock] = useState(
    initialProduct.idealStock != null ? String(initialProduct.idealStock) : "",
  );
  const [maxStock, setMaxStock] = useState(
    initialProduct.maxStock != null ? String(initialProduct.maxStock) : "",
  );
  const [unitOfMeasure, setUnitOfMeasure] = useState(
    String(initialProduct.unitOfMeasure ?? "unit"),
  );
  const [defaultStockLocationId, setDefaultStockLocationId] = useState(
    String(initialProduct.defaultStockLocationId ?? ""),
  );

  const [ncm, setNcm] = useState(String(initialProduct.ncm ?? ""));
  const [cest, setCest] = useState(String(initialProduct.cest ?? ""));
  const [cfopDefault, setCfopDefault] = useState(String(initialProduct.cfopDefault ?? ""));
  const [origin, setOrigin] = useState(String(initialProduct.origin ?? "0"));
  const [barcode, setBarcode] = useState(String(initialProduct.barcode ?? ""));

  const [weightGrams, setWeightGrams] = useState(
    initialProduct.weightGrams != null ? String(initialProduct.weightGrams) : "",
  );
  const [lengthCm, setLengthCm] = useState(
    initialProduct.lengthCm != null ? String(initialProduct.lengthCm) : "",
  );
  const [widthCm, setWidthCm] = useState(
    initialProduct.widthCm != null ? String(initialProduct.widthCm) : "",
  );
  const [heightCm, setHeightCm] = useState(
    initialProduct.heightCm != null ? String(initialProduct.heightCm) : "",
  );

  const [producedInternally, setProducedInternally] = useState(
    Boolean(initialProduct.producedInternally),
  );
  const [averageProductionTimeMinutes, setAverageProductionTimeMinutes] = useState(
    initialProduct.averageProductionTimeMinutes != null
      ? String(initialProduct.averageProductionTimeMinutes)
      : "",
  );
  const [laborCostPerHour, setLaborCostPerHour] = useState(
    initialProduct.laborCostPerHourCents != null
      ? centsToInput(Number(initialProduct.laborCostPerHourCents))
      : "",
  );
  const [productionProfileNotes, setProductionProfileNotes] = useState(
    String(initialProduct.productionProfileNotes ?? ""),
  );
  const [sellable, setSellable] = useState(
    initialProduct.sellable !== undefined ? Boolean(initialProduct.sellable) : true,
  );
  const [availableForEcommerce, setAvailableForEcommerce] = useState(
    initialProduct.availableForEcommerce !== undefined
      ? Boolean(initialProduct.availableForEcommerce)
      : true,
  );
  const [availableForPos, setAvailableForPos] = useState(
    initialProduct.availableForPos !== undefined ? Boolean(initialProduct.availableForPos) : true,
  );
  const [availableForEvents, setAvailableForEvents] = useState(
    Boolean(initialProduct.availableForEvents),
  );

  const [mainImageFileId, setMainImageFileId] = useState(
    String(initialProduct.mainImageFileId ?? ""),
  );
  const [galleryFileIdsText, setGalleryFileIdsText] = useState(() =>
    parseGalleryFileIdsFromProduct(initialProduct.imagesJson),
  );

  const galleryPreviewIds = useMemo(
    () => parseGalleryFileIdLines(galleryFileIdsText).filter(isPreviewableProductFileId),
    [galleryFileIdsText],
  );

  const [compChildId, setCompChildId] = useState("");
  const [compType, setCompType] = useState("bom");
  const [compQty, setCompQty] = useState("1");
  const [compQtyUnit, setCompQtyUnit] = useState("unit");
  const [compPackagingChannel, setCompPackagingChannel] = useState<"online" | "presential">(
    "online",
  );
  const [compRequired, setCompRequired] = useState(true);
  const [compDefault, setCompDefault] = useState(true);
  const [compNotes, setCompNotes] = useState("");

  const [compAddTarget, setCompAddTarget] = useState<"line" | "product">("product");
  const [editCompId, setEditCompId] = useState<string | null>(null);
  const [editCompScope, setEditCompScope] = useState<"line" | "product">("product");
  const [editCompChildId, setEditCompChildId] = useState("");
  const [editCompType, setEditCompType] = useState("bom");
  const [editCompQty, setEditCompQty] = useState("1");
  const [editCompQtyUnit, setEditCompQtyUnit] = useState("");
  const [editCompPackagingChannel, setEditCompPackagingChannel] = useState<"online" | "presential">(
    "online",
  );
  const [editCompRequired, setEditCompRequired] = useState(true);
  const [editCompDefault, setEditCompDefault] = useState(true);
  const [editCompNotes, setEditCompNotes] = useState("");
  const [expandedCompositionIds, setExpandedCompositionIds] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleCompositionExpand = (id: string) => {
    setExpandedCompositionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSupplyProduct = isSupplyChainProductType(productType);
  const visibleTabs = useMemo(() => visibleTabsForProductType(productType), [productType]);
  const productCostUnit = useMemo(() => productCostDisplayUnit(initialProduct), [initialProduct]);
  const productCostBaseTooltip = useMemo(
    () => productCostBaseInfoTooltip(initialProduct),
    [initialProduct],
  );

  useEffect(() => {
    if (isSupplyProduct && tab === "composition") {
      setTab("prices");
    }
  }, [isSupplyProduct, tab]);

  const saleCents = useMemo(() => inputToCents(salePrice), [salePrice]);
  const costCents = useMemo(() => inputToCents(costPrice), [costPrice]);

  const primaryTotalCostCents = useMemo(() => {
    if (costBreakdown) return costBreakdown.onlineTotalCostCents;
    return costCents;
  }, [costBreakdown, costCents]);

  const marginOnlinePct = pctMargin(saleCents, costBreakdown?.onlineTotalCostCents ?? null);
  const marginPresentialPct = pctMargin(saleCents, costBreakdown?.presentialTotalCostCents ?? null);
  const markupVal = markup(saleCents, primaryTotalCostCents);

  const bomRows = useMemo(
    () => initialCompositions.filter((r) => r.compositionType === "bom"),
    [initialCompositions],
  );
  const lineBomRows = useMemo(() => bomRows.filter((r) => r.scope === "line"), [bomRows]);
  const productBomRows = useMemo(() => bomRows.filter((r) => r.scope !== "line"), [bomRows]);
  const packagingRows = useMemo(
    () => initialCompositions.filter((r) => r.compositionType === "packaging"),
    [initialCompositions],
  );
  const linePackagingRows = useMemo(
    () => packagingRows.filter((r) => r.scope === "line"),
    [packagingRows],
  );
  const productPackagingRows = useMemo(
    () => packagingRows.filter((r) => r.scope !== "line"),
    [packagingRows],
  );
  const bomLegacyCostCount = useMemo(
    () => bomRows.filter((r) => r.childLegacyCostWarning).length,
    [bomRows],
  );
  const packagingLegacyCostCount = useMemo(
    () => packagingRows.filter((r) => r.childLegacyCostWarning).length,
    [packagingRows],
  );
  const snapshotSources = useMemo(
    () => [...new Set(initialCostSnapshots.map((s) => s.source))].sort(),
    [initialCostSnapshots],
  );
  const snapshotTotalPages = Math.max(
    1,
    Math.ceil((snapshotTotal || 0) / Math.max(1, snapshotLimit)),
  );

  useEffect(() => {
    if (expandedSnapshotId && !initialCostSnapshots.some((s) => s.id === expandedSnapshotId)) {
      setExpandedSnapshotId(null);
    }
  }, [expandedSnapshotId, initialCostSnapshots]);

  const updateSnapshotQuery = (patch: Partial<Record<string, string>>) => {
    if (!productId) return;
    const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (k === "source" && v === "all")) q.delete(k);
      else q.set(k, v);
    }
    const qs = q.toString();
    router.replace(`/products/${productId}${qs ? `?${qs}` : ""}`);
    router.refresh();
  };

  function buildPayload(): Record<string, unknown> {
    const galleryLines = parseGalleryFileIdLines(galleryFileIdsText);

    const payload: Record<string, unknown> = {
      sku: sku.trim(),
      name: name.trim(),
      internalName: internalName.trim() || undefined,
      productType,
      productKind,
      status,
      categoryId: categoryId || undefined,
      lineId: lineId || undefined,
      niche: niche.trim() || undefined,
      brand: brand.trim() || undefined,
      shortDescription: shortDescription.trim() || undefined,
      internalDescription: internalDescription.trim() || undefined,
      description: description.trim() || undefined,
      salePriceCents: saleCents,
      costPriceCents: costCents,
      promotionalPriceCents: promotionalPrice.trim() ? inputToCents(promotionalPrice) : undefined,
      eventPriceCents: eventPrice.trim() ? inputToCents(eventPrice) : undefined,
      wholesalePriceCents: wholesalePrice.trim() ? inputToCents(wholesalePrice) : undefined,
      compareAtPriceCents: compareAtPrice.trim() ? inputToCents(compareAtPrice) : undefined,
      controlsStock: productKind === "variable" ? false : controlsStock,
      minStock: nonNegativeIntFromInput(minStock) ?? 0,
      idealStock: nonNegativeIntFromInput(idealStock),
      maxStock: nonNegativeIntFromInput(maxStock),
      unitOfMeasure,
      defaultStockLocationId: defaultStockLocationId || undefined,
      ncm: ncm.trim() || undefined,
      cest: cest.trim() || undefined,
      cfopDefault: cfopDefault.trim() || undefined,
      origin: origin.trim() || "0",
      barcode: barcode.trim() || undefined,
      weightGrams: nonNegativeIntFromInput(weightGrams),
      lengthCm: lengthCm.trim() ? Number(lengthCm) : undefined,
      widthCm: widthCm.trim() ? Number(widthCm) : undefined,
      heightCm: heightCm.trim() ? Number(heightCm) : undefined,
      producedInternally,
      averageProductionTimeMinutes: nonNegativeIntFromInput(averageProductionTimeMinutes),
      laborCostPerHourCents: laborCostPerHour.trim() ? inputToCents(laborCostPerHour) : null,
      productionProfileNotes: productionProfileNotes.trim() || null,
      sellable: productKind === "variable" ? false : sellable,
      availableForEcommerce,
      availableForPos,
      availableForEvents,
      mainImageFileId: mainImageFileId.trim() || undefined,
      imagesJson: galleryLines,
    };
    return payload;
  }

  function save(navigateAfter?: "stay" | "list") {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const galleryCount = parseGalleryFileIdLines(galleryFileIdsText).length;
        if (galleryCount > MAX_GALLERY_IMAGE_SLOTS) {
          setError(
            `A galeria admite no máximo ${MAX_GALLERY_IMAGE_SLOTS} imagens (IDs). Reduz o número de linhas.`,
          );
          return;
        }
        const payload = buildPayload();
        if (mode === "new") {
          const id = await createProductOperationalAction(payload);
          setSuccess("Produto criado.");
          if (navigateAfter === "list") {
            if (embedded && onClose) onClose();
            else router.push("/products");
          } else router.push(`/products/${id}`);
          router.refresh();
        } else if (productId) {
          await updateProductOperationalAction(productId, payload);
          setSuccess("Alterações salvas.");
          router.refresh();
          if (navigateAfter === "list") {
            if (embedded && onClose) onClose();
            else router.push("/products");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  async function handleProductMediaFileSelected(
    file: File | undefined,
    target: "main" | "gallery",
  ) {
    if (!file) return;
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setError("Imagem demasiado grande (máx. 5 MB).");
      return;
    }
    if (target === "gallery") {
      const current = parseGalleryFileIdLines(galleryFileIdsText).length;
      if (current >= MAX_GALLERY_IMAGE_SLOTS) {
        setError(`A galeria já tem o máximo de ${MAX_GALLERY_IMAGE_SLOTS} imagens.`);
        return;
      }
    }
    setError(null);
    setSuccess(null);
    setMediaUploadKind(target);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (productId) fd.append("productId", productId);
      const res = await fetch("/api/products/media-upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      let json: { message?: string; data?: UploadedProductMediaRow };
      try {
        json = (await res.json()) as typeof json;
      } catch {
        throw new Error(
          `Resposta inválida do servidor (HTTP ${res.status}). Se o arquivo for grande, pode ser limite da infraestrutura (ex.: Vercel).`,
        );
      }
      if (!res.ok) {
        throw new Error(
          json.message ??
            (res.status === 413
              ? "Ficheiro demasiado grande para o limite do servidor web (tenta reduzir o tamanho da imagem)."
              : `Upload falhou (HTTP ${res.status}).`),
        );
      }
      if (!json.data) {
        throw new Error("Resposta inválida: a API não retornou os dados do arquivo.");
      }
      const row = json.data;
      if (target === "main") {
        setMainImageFileId(row.id);
        setSuccess("Imagem principal enviada para o storage.");
      } else {
        setGalleryFileIdsText((prev) => {
          const lines = parseGalleryFileIdLines(prev);
          if (!lines.includes(row.id)) lines.push(row.id);
          return lines.join("\n");
        });
        setSuccess("Imagem adicionada à galeria (ID anexado ao texto).");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setMediaUploadKind(null);
      if (target === "main" && mainImageFileInputRef.current) {
        mainImageFileInputRef.current.value = "";
      }
      if (target === "gallery" && galleryImageFileInputRef.current) {
        galleryImageFileInputRef.current.value = "";
      }
    }
  }

  async function addComposition(target: "line" | "product" = compAddTarget) {
    if (!productId) return;
    if (target === "line" && !lineId) {
      setError("Escolha uma linha na aba Geral antes de adicionar à receita da linha.");
      return;
    }
    setError(null);
    try {
      const qty = Number(compQty.replace(",", "."));
      if (!compChildId || !(qty > 0)) {
        setError("Selecione o componente e informe quantidade > 0.");
        return;
      }
      const body = {
        childProductId: compChildId,
        quantity: qty,
        quantityUnit: compQtyUnit.trim() || undefined,
        compositionType: compType,
        packagingChannel: compType === "packaging" ? compPackagingChannel : undefined,
        required: compRequired,
        isDefault: compDefault,
        notes: compNotes.trim() || undefined,
      };
      if (target === "line") {
        await addLineCompositionAction(lineId, body);
      } else {
        await addProductCompositionAction(productId, body);
      }
      setCompChildId("");
      setCompQty("1");
      setCompQtyUnit("unit");
      setCompNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar composição");
    }
  }

  function compositionApiId(row: CompositionRow): string {
    return row.sourceCompositionId ?? row.id;
  }

  async function removeComposition(row: CompositionRow) {
    if (!productId) return;
    setError(null);
    const compId = compositionApiId(row);
    try {
      if (row.scope === "line") {
        await removeLineCompositionAction(compId);
      } else {
        await removeProductCompositionAction(productId, compId);
      }
      if (editCompId === row.id) setEditCompId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  function startEditComposition(row: CompositionRow) {
    setEditCompId(row.id);
    setEditCompScope(row.scope === "line" ? "line" : "product");
    setEditCompChildId(row.childProductId);
    setEditCompType(row.compositionType);
    setEditCompQty(String(row.quantity));
    setEditCompQtyUnit(row.quantityUnit ?? "unit");
    setEditCompPackagingChannel(row.packagingChannel === "presential" ? "presential" : "online");
    setEditCompRequired(row.required);
    setEditCompDefault(row.isDefault);
    setEditCompNotes(row.notes ?? "");
    setError(null);
  }

  function cancelEditComposition() {
    setEditCompId(null);
  }

  async function saveEditComposition() {
    if (!productId || !editCompId) return;
    setError(null);
    const qty = Number(editCompQty.replace(",", "."));
    if (!editCompChildId || !(qty > 0)) {
      setError("Na edição, selecione o componente e quantidade > 0.");
      return;
    }
    try {
      const row = initialCompositions.find((r) => r.id === editCompId);
      const apiId = row ? compositionApiId(row) : editCompId;
      const body = {
        childProductId: editCompChildId,
        compositionType: editCompType,
        quantity: qty,
        quantityUnit: editCompQtyUnit.trim() || undefined,
        packagingChannel: editCompType === "packaging" ? editCompPackagingChannel : null,
        required: editCompRequired,
        isDefault: editCompDefault,
        notes: editCompNotes.trim() || undefined,
      };
      if (editCompScope === "line") {
        await updateLineCompositionAction(apiId, body);
      } else {
        await updateProductCompositionAction(productId, apiId, body);
      }
      setEditCompId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar composição");
    }
  }

  const packagingHint =
    productType === "packaging"
      ? "Este cadastro representa uma embalagem com estoque e custo próprios."
      : null;

  return (
    <div
      className={
        embedded ? "mx-0 max-w-none px-3 py-4 sm:px-4" : "mx-auto max-w-7xl px-4 py-6 lg:px-8"
      }
    >
      {!embedded ? (
        <nav className="mb-2 text-sm text-zinc-500">
          <Link href="/products" className="hover:text-zinc-800">
            Produtos
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-800">{mode === "new" ? "Novo produto" : sku || "Editar"}</span>
        </nav>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {mode === "new" ? "Novo produto" : name || "Produto"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Cadastro operacional — dados canônicos para estoque, custos e fiscal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save("stay")}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save("list")}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {embedded ? "Salvar e fechar" : "Salvar e voltar"}
          </button>
          {embedded && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Fechar
            </button>
          ) : (
            <Link
              href="/products"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancelar
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            {tab === "general" && (
              <div className="grid gap-4 md:grid-cols-2">
                {packagingHint && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 md:col-span-2">
                    {packagingHint}
                  </div>
                )}
                {productType === "finished_product" && (
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 md:col-span-2">
                    Produto final: utilize as abas Preços, Composição e Canais (painel à direita)
                    para precificação, BOM/embalagens e disponibilidade por canal de venda.
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">SKU *</label>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                {mode === "edit" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">Ref</label>
                    <input
                      readOnly
                      tabIndex={-1}
                      value={String(initialProduct.externalRef ?? "")}
                      className="w-full cursor-default rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800"
                    />
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Referência estável do sistema (PRD-NNNN); não editável.
                    </p>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Nome *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Nome interno
                  </label>
                  <input
                    value={internalName}
                    onChange={(e) => setInternalName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Tipo do produto *
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProductType(v);
                      if (v === "service") setControlsStock(false);
                      else if (v === "packaging" || v === "raw_material") setControlsStock(true);
                    }}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {PRODUCT_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-4 py-3 md:col-span-2">
                  <span className="mb-2 block text-xs font-medium text-zinc-600">
                    Estrutura do produto
                  </span>
                  <div className="flex flex-wrap gap-6 text-sm text-zinc-800">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="productKind"
                        checked={productKind === "simple"}
                        onChange={() => setProductKind("simple")}
                      />
                      Produto simples
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="productKind"
                        checked={productKind === "variable"}
                        onChange={() => setProductKind("variable")}
                      />
                      Produto com variações
                    </label>
                  </div>
                  {productKind === "variable" ? (
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                      O cadastro pai agrupa variações. Estoque real, SKU de venda e preços por linha
                      definem-se no separador <strong>Variações</strong>. O estoque mostrado no pai
                      será a soma das variações ativas.
                    </p>
                  ) : null}
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Linha</label>
                  <select
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {lines.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Nicho</label>
                  <input
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Marca</label>
                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Descrição curta (operacional)
                  </label>
                  <textarea
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Descrição interna
                  </label>
                  <textarea
                    value={internalDescription}
                    onChange={(e) => setInternalDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Descrição longa (legado / integrações)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="Texto livre adicional quando necessário para sistemas legados."
                  />
                </div>
              </div>
            )}

            {tab === "prices" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {!isSupplyProduct ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">
                        Preço de venda (R$)
                      </label>
                      <input
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                      />
                    </div>
                  ) : null}
                  <div className={isSupplyProduct ? "md:col-span-2" : undefined}>
                    <label className="mb-1 flex flex-wrap items-center gap-1 text-xs font-medium text-zinc-600">
                      <span>Custo base (R$)</span>
                      {isSupplyProduct ? (
                        <>
                          <span className="font-normal text-zinc-500">— por {productCostUnit}</span>
                          <CompositionColumnHelp title={productCostBaseTooltip} />
                        </>
                      ) : null}
                    </label>
                    <input
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className={`w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums ${isSupplyProduct ? "max-w-xs" : ""}`}
                    />
                    {isSupplyProduct ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Com compras lançadas, a composição usa a média das 2 últimas entradas. Sem
                        compras, usa o valor deste campo.
                      </p>
                    ) : null}
                  </div>
                  {!isSupplyProduct ? (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Preço promocional (R$)
                        </label>
                        <input
                          value={promotionalPrice}
                          onChange={(e) => setPromotionalPrice(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Preço evento (R$)
                        </label>
                        <input
                          value={eventPrice}
                          onChange={(e) => setEventPrice(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Preço atacado (R$)
                        </label>
                        <input
                          value={wholesalePrice}
                          onChange={(e) => setWholesalePrice(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Preço de referência — compare at (R$)
                        </label>
                        <input
                          value={compareAtPrice}
                          onChange={(e) => setCompareAtPrice(e.target.value)}
                          className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                          placeholder="Opcional"
                        />
                        <p className="mt-1 text-xs text-zinc-500">
                          Campo legado para “preço antes da promoção” em integrações; o ERP prioriza
                          preço promocional explícito quando ambos existirem.
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
                  <p className="font-medium text-zinc-800">Custos (servidor)</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {isSupplyProduct
                      ? "O custo médio abaixo vem das 2 últimas compras. Lance-as em Compras → Recebimentos."
                      : "Custo base (campo acima) é independente. Totais com composição e produção vêm da aba Composição e do perfil de produção."}
                  </p>
                  <ul className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                    <li>
                      Custo médio atual:{" "}
                      {initialProduct.averageCostDecimal != null
                        ? `R$ ${Number(initialProduct.averageCostDecimal).toFixed(4)}`
                        : "—"}
                    </li>
                    <li>
                      Unidade do custo médio:{" "}
                      {initialProduct.averageCostUnit
                        ? unitLabelPt(String(initialProduct.averageCostUnit))
                        : "—"}
                    </li>
                    <li>
                      Último custo de compra:{" "}
                      {initialProduct.lastPurchaseCostDecimal != null
                        ? `R$ ${Number(initialProduct.lastPurchaseCostDecimal).toFixed(4)}`
                        : "—"}
                    </li>
                    <li>
                      Origem do custo:{" "}
                      {productCostSourceLabel(String(initialProduct.costSource ?? "unknown"))}
                    </li>
                    <li>
                      Atualizado em:{" "}
                      {String(initialProduct.costUpdatedAt ?? initialProduct.updatedAt ?? "—")}
                    </li>
                  </ul>
                  {costBreakdown ? (
                    <ul className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                      <li>Materiais: {formatCurrency(costBreakdown.materialCostCents)}</li>
                      <li>Emb. online: {formatCurrency(costBreakdown.packagingOnlineCostCents)}</li>
                      <li>
                        Emb. presencial:{" "}
                        {formatCurrency(costBreakdown.packagingPresentialCostCents)}
                      </li>
                      <li>Mão de obra: {formatCurrency(costBreakdown.laborCostCents)}</li>
                      <li className="font-medium text-zinc-800">
                        Total online: {formatCurrency(costBreakdown.onlineTotalCostCents)}
                      </li>
                      <li className="font-medium text-zinc-800">
                        Total presencial: {formatCurrency(costBreakdown.presentialTotalCostCents)}
                      </li>
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">
                      {isSupplyProduct
                        ? "Este tipo de produto não possui composição própria; custos agregados aparecem nos produtos finais que o utilizam."
                        : "Guarde o produto e defina composição para ver o detalhe de custos."}
                    </p>
                  )}
                  {mode === "edit" && productId && initialBomParents.length > 0 ? (
                    <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-zinc-700">
                        Usado na composição (BOM) de
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                        {initialBomParents.map((p) => (
                          <li key={p.parentProductId}>
                            <Link
                              href={`/products/${p.parentProductId}`}
                              className="font-medium text-zinc-900 underline hover:text-zinc-700"
                            >
                              {p.parentName ?? p.parentProductId}
                            </Link>
                            {p.parentSku ? (
                              <span className="ml-2 font-mono text-zinc-500">{p.parentSku}</span>
                            ) : null}
                            {p.lineCount > 1 ? (
                              <span className="ml-2 text-zinc-500">({p.lineCount} linhas)</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {!isSupplyProduct ? (
                    <div className="mt-3 flex flex-wrap gap-4 border-t border-zinc-200 pt-3 text-zinc-800">
                      <span>
                        Margem (online):{" "}
                        <strong>
                          {marginOnlinePct === null ? "—" : `${marginOnlinePct.toFixed(1)}%`}
                        </strong>
                      </span>
                      <span>
                        Margem (presencial):{" "}
                        <strong>
                          {marginPresentialPct === null
                            ? "—"
                            : `${marginPresentialPct.toFixed(1)}%`}
                        </strong>
                      </span>
                      <span>
                        Markup (ref. online):{" "}
                        <strong>{markupVal === null ? "—" : `${markupVal.toFixed(2)}×`}</strong>
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {tab === "stock" && (
              <div className="grid gap-4 md:grid-cols-2">
                {productKind === "variable" ? (
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 md:col-span-2">
                    Este produto tem variações: o estoque movimenta-se ao nível de cada variação. O
                    valor agregado no pai é calculado automaticamente.
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={productKind === "variable" ? false : controlsStock}
                    disabled={productKind === "variable"}
                    onChange={(e) => setControlsStock(e.target.checked)}
                  />
                  Controla estoque?
                </label>
                <div />
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Estoque mínimo
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Estoque ideal
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={idealStock}
                    onChange={(e) => setIdealStock(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Estoque máximo
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Unidade de medida
                  </label>
                  <select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Local padrão de estoque
                  </label>
                  <select
                    value={defaultStockLocationId}
                    onChange={(e) => setDefaultStockLocationId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                {mode === "edit" && productId ? (
                  <div className="space-y-4 md:col-span-2">
                    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
                      <p className="font-medium text-zinc-800">Estoque atual (agregado)</p>
                      <p className="mt-1 text-zinc-700 tabular-nums">
                        {String(initialProduct.currentStock ?? 0)}{" "}
                        <span className="text-zinc-500">
                          ({unitLabelPt(String(initialProduct.unitOfMeasure ?? "unit"))})
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-sm font-medium text-zinc-800">Últimas movimentações</p>
                      {initialStockMovements.length === 0 ? (
                        <p className="mt-2 text-xs text-zinc-500">Nenhum movimento registrado.</p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="border-b border-zinc-200 text-zinc-500">
                              <tr>
                                <th className="py-1.5 pr-3">Data</th>
                                <th className="py-1.5 pr-3">Tipo</th>
                                <th className="py-1.5 pr-3 text-right">Qtd</th>
                                <th className="py-1.5 pr-3">Local</th>
                                <th className="py-1.5 pr-3">Ref.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {initialStockMovements.map((m) => (
                                <tr key={m.id} className="border-b border-zinc-100 text-zinc-700">
                                  <td className="py-1.5 pr-3 text-zinc-600 tabular-nums">
                                    {formatDateTime(m.createdAt)}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {m.quantity}
                                  </td>
                                  <td className="py-1.5 pr-3">{m.locationName}</td>
                                  <td className="py-1.5 pr-3">
                                    {m.referenceType === "purchase_receipt" && m.referenceId ? (
                                      <Link
                                        href={`/purchases/receipts/${m.referenceId}`}
                                        className="text-sky-700 underline hover:text-sky-900"
                                      >
                                        Entrada
                                      </Link>
                                    ) : (
                                      <span className="text-zinc-500">
                                        {m.referenceType ?? "—"}
                                        {m.referenceId ? ` · ${m.referenceId.slice(0, 8)}…` : ""}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
                      <p className="text-sm font-medium text-zinc-800">
                        Histórico de entradas (NF / manual)
                      </p>
                      {initialPurchaseReceiptHistory.length === 0 ? (
                        <p className="mt-2 text-xs text-zinc-500">
                          Nenhuma entrada de compra vinculada a este produto.
                        </p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead className="border-b border-zinc-200 text-zinc-500">
                              <tr>
                                <th className="py-1.5 pr-3">Recebido</th>
                                <th className="py-1.5 pr-3">Doc.</th>
                                <th className="py-1.5 pr-3 text-right">Qtd</th>
                                <th className="py-1.5 pr-3 text-right">Total</th>
                                <th className="py-1.5 pr-3" />
                              </tr>
                            </thead>
                            <tbody>
                              {initialPurchaseReceiptHistory.map((r) => (
                                <tr
                                  key={`${r.receiptId}-${r.receiptItemId}`}
                                  className="border-b border-zinc-100 text-zinc-700"
                                >
                                  <td className="py-1.5 pr-3 text-zinc-600 tabular-nums">
                                    {formatDateTime(r.receivedAt)}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    {r.documentNumber ?? r.documentType}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {r.stockQuantity} {r.stockUnit}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {formatCurrency(r.totalCostCents)}
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <Link
                                      href={`/purchases/receipts/${r.receiptId}`}
                                      className="text-sky-700 underline hover:text-sky-900"
                                    >
                                      Abrir
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {tab === "composition" && (
              <div className="space-y-4">
                {mode === "new" && (
                  <p className="text-sm text-zinc-600">
                    Salve o produto primeiro para associar embalagens, BOM, kits e outros
                    componentes.
                  </p>
                )}
                {mode === "edit" && productId && (
                  <>
                    <p className="text-xs leading-relaxed text-zinc-600">
                      A composição define a receita técnica do produto. Os custos são calculados a
                      partir do custo atual dos componentes. Compras e entradas atualizam o custo
                      médio dos materiais.
                    </p>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-zinc-900">
                        1. Materiais de produção (BOM)
                      </h3>
                      <CompositionLegacyCostBanner count={bomLegacyCostCount} />
                      <div className="overflow-x-auto rounded-lg border border-zinc-200">
                        <table className="w-full min-w-[56rem] text-left text-sm">
                          <colgroup>
                            <col className="w-[min(22rem,28%)]" />
                            <col className="w-[9.5rem]" />
                            <col className="w-[10.5rem]" />
                            <col className="w-[6.5rem]" />
                            <col className="w-[9rem]" />
                            <col />
                            <col className="w-[7.5rem]" />
                            <col className="w-[9rem]" />
                            <col className="w-[5.5rem]" />
                            <col className="w-[4.5rem]" />
                          </colgroup>
                          <thead className="border-b border-zinc-200 bg-zinc-50">
                            <tr>
                              <th className={compositionTableTh}>Componente</th>
                              <th className={compositionTableTh}>Tipo do componente</th>
                              <CompositionCostHeader
                                label="Custo base"
                                tooltip={COMPOSITION_COST_BASE_HEADER_TOOLTIP}
                              />
                              <th className={compositionTableThNumeric}>Uso por peça</th>
                              <CompositionCostHeader
                                label={<CompositionCalculatedUsageCostHeaderLabel />}
                                tooltip={COMPOSITION_COST_ON_PRODUCT_HEADER_TOOLTIP}
                              />
                              <th className={compositionTableTh}>Fonte do custo</th>
                              <th className={compositionTableTh}>Atualizado em</th>
                              <th className={compositionTableTh}>Última compra/entrada</th>
                              <th className={compositionTableTh}>Notas</th>
                              <th className={`${compositionTableTh} w-0`} aria-label="Ações" />
                            </tr>
                          </thead>
                          <tbody>
                            {lineBomRows.length === 0 && productBomRows.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-3 py-4 text-center text-zinc-500">
                                  Nenhum material na BOM.
                                </td>
                              </tr>
                            ) : (
                              <>
                                {lineBomRows.length > 0 ? (
                                  <tr className="bg-sky-50/80">
                                    <td
                                      colSpan={10}
                                      className="px-3 py-2 text-xs font-semibold text-sky-900"
                                    >
                                      Receita da linha
                                    </td>
                                  </tr>
                                ) : null}
                                {lineBomRows.map((row) =>
                                  editCompId === row.id ? (
                                    <tr
                                      key={row.id}
                                      className="border-b border-zinc-100 bg-zinc-50"
                                    >
                                      <td colSpan={10} className="px-3 py-4">
                                        <p className="mb-3 text-xs font-semibold text-zinc-700">
                                          Editar linha (BOM)
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                          <div className="lg:col-span-2">
                                            <CompositionProductPicker
                                              value={editCompChildId}
                                              onChange={setEditCompChildId}
                                              excludeProductId={productId}
                                              selectedSku={row.childSku}
                                              selectedName={row.childName}
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Tipo do componente
                                            </label>
                                            <select
                                              value={editCompType}
                                              onChange={(e) => setEditCompType(e.target.value)}
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            >
                                              {COMPOSITION_TYPES_EDIT.map((c) => (
                                                <option key={c.value} value={c.value}>
                                                  {c.label}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600">
                                              Uso por peça
                                              <CompositionColumnHelp
                                                title={COMPOSITION_USAGE_PER_PIECE_TOOLTIP}
                                              />
                                            </label>
                                            <input
                                              value={editCompQty}
                                              onChange={(e) => setEditCompQty(e.target.value)}
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Unidade de uso
                                            </label>
                                            <CompositionUsageUnitSelect
                                              value={editCompQtyUnit}
                                              onChange={setEditCompQtyUnit}
                                            />
                                          </div>
                                          {editCompType === "packaging" ? (
                                            <div>
                                              <label className="mb-1 block text-xs text-zinc-600">
                                                Canal embalagem
                                              </label>
                                              <select
                                                value={editCompPackagingChannel}
                                                onChange={(e) =>
                                                  setEditCompPackagingChannel(
                                                    e.target.value as "online" | "presential",
                                                  )
                                                }
                                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                              >
                                                <option value="online">Online</option>
                                                <option value="presential">Presencial</option>
                                              </select>
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-4">
                                          <label className="flex items-center gap-2 text-sm">
                                            <input
                                              type="checkbox"
                                              checked={editCompRequired}
                                              onChange={(e) =>
                                                setEditCompRequired(e.target.checked)
                                              }
                                            />
                                            Obrigatório
                                          </label>
                                          <label className="flex items-center gap-2 text-sm">
                                            <input
                                              type="checkbox"
                                              checked={editCompDefault}
                                              onChange={(e) => setEditCompDefault(e.target.checked)}
                                            />
                                            Padrão
                                          </label>
                                        </div>
                                        <div className="mt-3">
                                          <label className="mb-1 block text-xs text-zinc-600">
                                            Observações
                                          </label>
                                          <input
                                            value={editCompNotes}
                                            onChange={(e) => setEditCompNotes(e.target.value)}
                                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                          />
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() => saveEditComposition()}
                                            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                          >
                                            Salvar linha
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => cancelEditComposition()}
                                            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    <CompositionDisplayRows
                                      key={row.id}
                                      row={row}
                                      kind="bom"
                                      colSpan={10}
                                      showNotes
                                      expanded={expandedCompositionIds.has(row.id)}
                                      onToggleExpand={() => toggleCompositionExpand(row.id)}
                                      onEdit={() => startEditComposition(row)}
                                      onRemove={() => removeComposition(row)}
                                    />
                                  ),
                                )}
                                {productBomRows.length > 0 ? (
                                  <tr>
                                    <td
                                      colSpan={10}
                                      className="bg-white px-3 py-2 text-xs font-semibold text-zinc-800"
                                    >
                                      Específico deste produto
                                    </td>
                                  </tr>
                                ) : null}
                                {productBomRows.map((row) =>
                                  editCompId === row.id ? (
                                    <tr
                                      key={row.id}
                                      className="border-b border-zinc-100 bg-zinc-50"
                                    >
                                      <td colSpan={10} className="px-3 py-4">
                                        <p className="mb-3 text-xs font-semibold text-zinc-700">
                                          Editar linha (BOM — produto)
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                          <div className="lg:col-span-2">
                                            <CompositionProductPicker
                                              value={editCompChildId}
                                              onChange={setEditCompChildId}
                                              excludeProductId={productId}
                                              selectedSku={row.childSku}
                                              selectedName={row.childName}
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Tipo do componente
                                            </label>
                                            <select
                                              value={editCompType}
                                              onChange={(e) => setEditCompType(e.target.value)}
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            >
                                              {COMPOSITION_TYPES_EDIT.map((c) => (
                                                <option key={c.value} value={c.value}>
                                                  {c.label}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600">
                                              Uso por peça
                                              <CompositionColumnHelp
                                                title={COMPOSITION_USAGE_PER_PIECE_TOOLTIP}
                                              />
                                            </label>
                                            <input
                                              value={editCompQty}
                                              onChange={(e) => setEditCompQty(e.target.value)}
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Unidade de uso
                                            </label>
                                            <CompositionUsageUnitSelect
                                              value={editCompQtyUnit}
                                              onChange={setEditCompQtyUnit}
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() => saveEditComposition()}
                                            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                          >
                                            Salvar linha
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => cancelEditComposition()}
                                            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    <CompositionDisplayRows
                                      key={row.id}
                                      row={row}
                                      kind="bom"
                                      colSpan={10}
                                      showNotes
                                      expanded={expandedCompositionIds.has(row.id)}
                                      onToggleExpand={() => toggleCompositionExpand(row.id)}
                                      onEdit={() => startEditComposition(row)}
                                      onRemove={() => removeComposition(row)}
                                    />
                                  ),
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4">
                      <h3 className="text-sm font-semibold text-zinc-900">2. Embalagem</h3>
                      <CompositionLegacyCostBanner count={packagingLegacyCostCount} />
                      <div className="overflow-x-auto rounded-lg border border-zinc-200">
                        <table className="w-full min-w-[52rem] text-left text-sm">
                          <colgroup>
                            <col className="w-[min(22rem,30%)]" />
                            <col className="w-[6rem]" />
                            <col className="w-[10.5rem]" />
                            <col className="w-[6.5rem]" />
                            <col className="w-[9rem]" />
                            <col />
                            <col className="w-[7.5rem]" />
                            <col className="w-[9rem]" />
                            <col className="w-[4.5rem]" />
                          </colgroup>
                          <thead className="border-b border-zinc-200 bg-zinc-50">
                            <tr>
                              <th className={compositionTableTh}>Componente</th>
                              <th className={compositionTableTh}>Canal</th>
                              <CompositionCostHeader
                                label="Custo base"
                                tooltip={COMPOSITION_COST_BASE_HEADER_TOOLTIP}
                              />
                              <th className={compositionTableThNumeric}>Uso por peça</th>
                              <CompositionCostHeader
                                label={<CompositionCalculatedUsageCostHeaderLabel />}
                                tooltip={COMPOSITION_COST_ON_PRODUCT_HEADER_TOOLTIP}
                              />
                              <th className={compositionTableTh}>Fonte do custo</th>
                              <th className={compositionTableTh}>Atualizado em</th>
                              <th className={compositionTableTh}>Última compra/entrada</th>
                              <th className={`${compositionTableTh} w-0`} aria-label="Ações" />
                            </tr>
                          </thead>
                          <tbody>
                            {linePackagingRows.length === 0 && productPackagingRows.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-3 py-4 text-center text-zinc-500">
                                  Nenhuma embalagem cadastrada.
                                </td>
                              </tr>
                            ) : (
                              <>
                                {linePackagingRows.length > 0 ? (
                                  <tr className="bg-sky-50/80">
                                    <td
                                      colSpan={9}
                                      className="px-3 py-2 text-xs font-semibold text-sky-900"
                                    >
                                      Receita da linha
                                    </td>
                                  </tr>
                                ) : null}
                                {linePackagingRows.map((row) =>
                                  editCompId === row.id ? (
                                    <tr
                                      key={row.id}
                                      className="border-b border-zinc-100 bg-zinc-50"
                                    >
                                      <td colSpan={9} className="px-3 py-4">
                                        <p className="mb-3 text-xs font-semibold text-zinc-700">
                                          Editar linha (embalagem)
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                          <div className="lg:col-span-2">
                                            <CompositionProductPicker
                                              value={editCompChildId}
                                              onChange={setEditCompChildId}
                                              excludeProductId={productId}
                                              selectedSku={row.childSku}
                                              selectedName={row.childName}
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Canal *
                                            </label>
                                            <select
                                              value={editCompPackagingChannel}
                                              onChange={(e) =>
                                                setEditCompPackagingChannel(
                                                  e.target.value as "online" | "presential",
                                                )
                                              }
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            >
                                              <option value="online">Online</option>
                                              <option value="presential">Presencial</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600">
                                              Uso por peça
                                              <CompositionColumnHelp
                                                title={COMPOSITION_USAGE_PER_PIECE_TOOLTIP}
                                              />
                                            </label>
                                            <input
                                              value={editCompQty}
                                              onChange={(e) => setEditCompQty(e.target.value)}
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Unidade de uso
                                            </label>
                                            <CompositionUsageUnitSelect
                                              value={editCompQtyUnit}
                                              onChange={setEditCompQtyUnit}
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() => saveEditComposition()}
                                            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                          >
                                            Salvar linha
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => cancelEditComposition()}
                                            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    <CompositionDisplayRows
                                      key={row.id}
                                      row={row}
                                      kind="packaging"
                                      colSpan={9}
                                      showNotes={false}
                                      expanded={expandedCompositionIds.has(row.id)}
                                      onToggleExpand={() => toggleCompositionExpand(row.id)}
                                      onEdit={() => startEditComposition(row)}
                                      onRemove={() => removeComposition(row)}
                                    />
                                  ),
                                )}
                                {productPackagingRows.length > 0 ? (
                                  <tr>
                                    <td
                                      colSpan={9}
                                      className="px-3 py-2 text-xs font-semibold text-zinc-800"
                                    >
                                      Específico deste produto
                                    </td>
                                  </tr>
                                ) : null}
                                {productPackagingRows.map((row) =>
                                  editCompId === row.id ? (
                                    <tr
                                      key={row.id}
                                      className="border-b border-zinc-100 bg-zinc-50"
                                    >
                                      <td colSpan={9} className="px-3 py-4">
                                        <p className="mb-3 text-xs font-semibold text-zinc-700">
                                          Editar embalagem (produto)
                                        </p>
                                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                          <div className="lg:col-span-2">
                                            <CompositionProductPicker
                                              value={editCompChildId}
                                              onChange={setEditCompChildId}
                                              excludeProductId={productId}
                                              selectedSku={row.childSku}
                                              selectedName={row.childName}
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Canal *
                                            </label>
                                            <select
                                              value={editCompPackagingChannel}
                                              onChange={(e) =>
                                                setEditCompPackagingChannel(
                                                  e.target.value as "online" | "presential",
                                                )
                                              }
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            >
                                              <option value="online">Online</option>
                                              <option value="presential">Presencial</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600">
                                              Uso por peça
                                              <CompositionColumnHelp
                                                title={COMPOSITION_USAGE_PER_PIECE_TOOLTIP}
                                              />
                                            </label>
                                            <input
                                              value={editCompQty}
                                              onChange={(e) => setEditCompQty(e.target.value)}
                                              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs text-zinc-600">
                                              Unidade de uso
                                            </label>
                                            <CompositionUsageUnitSelect
                                              value={editCompQtyUnit}
                                              onChange={setEditCompQtyUnit}
                                            />
                                          </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() => saveEditComposition()}
                                            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                          >
                                            Salvar linha
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => cancelEditComposition()}
                                            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    <CompositionDisplayRows
                                      key={row.id}
                                      row={row}
                                      kind="packaging"
                                      colSpan={9}
                                      showNotes={false}
                                      expanded={expandedCompositionIds.has(row.id)}
                                      onToggleExpand={() => toggleCompositionExpand(row.id)}
                                      onEdit={() => startEditComposition(row)}
                                      onRemove={() => removeComposition(row)}
                                    />
                                  ),
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {costBreakdown ? (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                        <h3 className="text-sm font-semibold text-zinc-900">3. Resumo de custos</h3>
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div className="flex justify-between gap-2">
                            <dt className="text-zinc-600">Custo materiais</dt>
                            <dd className="text-zinc-900 tabular-nums">
                              {formatCurrency(costBreakdown.materialCostCents)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-zinc-600">Embalagem online</dt>
                            <dd className="text-zinc-900 tabular-nums">
                              {formatCurrency(costBreakdown.packagingOnlineCostCents)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-zinc-600">Embalagem presencial</dt>
                            <dd className="text-zinc-900 tabular-nums">
                              {formatCurrency(costBreakdown.packagingPresentialCostCents)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-zinc-600">Mão de obra</dt>
                            <dd className="text-zinc-900 tabular-nums">
                              {formatCurrency(costBreakdown.laborCostCents)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2 border-t border-zinc-200 pt-2 sm:col-span-2">
                            <dt className="font-medium text-zinc-800">Custo total online</dt>
                            <dd className="font-medium text-zinc-900 tabular-nums">
                              {formatCurrency(costBreakdown.onlineTotalCostCents)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2 sm:col-span-2">
                            <dt className="font-medium text-zinc-800">Custo total presencial</dt>
                            <dd className="font-medium text-zinc-900 tabular-nums">
                              {formatCurrency(costBreakdown.presentialTotalCostCents)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}

                    {initialCompositions.some(
                      (r) => r.compositionType !== "bom" && r.compositionType !== "packaging",
                    ) ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                        Existem linhas legadas (kit, bundle, etc.). Edite-as na lista unificada
                        abaixo ou remova e recrie como BOM/embalagem.
                        <div className="mt-2 overflow-x-auto rounded border border-amber-200 bg-white">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-zinc-50 text-xs text-zinc-600 uppercase">
                              <tr>
                                <th className="px-2 py-1">Componente</th>
                                <th className="px-2 py-1">Tipo do componente</th>
                                <th className="px-2 py-1">Uso por peça</th>
                                <th className="px-2 py-1" />
                              </tr>
                            </thead>
                            <tbody>
                              {initialCompositions
                                .filter(
                                  (r) =>
                                    r.compositionType !== "bom" &&
                                    r.compositionType !== "packaging",
                                )
                                .map((row) => (
                                  <tr key={row.id} className="border-t border-zinc-100">
                                    <td className="px-2 py-1">
                                      {row.childName ?? row.childProductId}
                                    </td>
                                    <td className="px-2 py-1">{row.compositionType}</td>
                                    <td className="px-2 py-1">
                                      {compositionUsagePerPieceLabel(
                                        row.quantity,
                                        row.quantityUnit,
                                      )}
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      <button
                                        type="button"
                                        className="text-xs text-zinc-600 underline"
                                        onClick={() => startEditComposition(row)}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        className="ml-2 text-xs text-red-600 hover:underline"
                                        onClick={() => removeComposition(row)}
                                      >
                                        Remover
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                      <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
                        Adicionar componente
                      </p>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="lg:col-span-2">
                          <CompositionProductPicker
                            value={compChildId}
                            onChange={setCompChildId}
                            excludeProductId={productId}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-600">
                            Tipo do componente
                          </label>
                          <select
                            value={compType}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCompType(v);
                            }}
                            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          >
                            {COMPOSITION_TYPES_ADD.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-zinc-600">
                            Uso por peça
                            <CompositionColumnHelp title={COMPOSITION_USAGE_PER_PIECE_TOOLTIP} />
                          </label>
                          <input
                            value={compQty}
                            onChange={(e) => setCompQty(e.target.value)}
                            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-600">Unidade de uso</label>
                          <CompositionUsageUnitSelect
                            value={compQtyUnit}
                            onChange={setCompQtyUnit}
                          />
                        </div>
                        {compType === "packaging" ? (
                          <div>
                            <label className="mb-1 block text-xs text-zinc-600">
                              Canal embalagem *
                            </label>
                            <select
                              value={compPackagingChannel}
                              onChange={(e) =>
                                setCompPackagingChannel(e.target.value as "online" | "presential")
                              }
                              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                            >
                              <option value="online">Online</option>
                              <option value="presential">Presencial</option>
                            </select>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={compRequired}
                            onChange={(e) => setCompRequired(e.target.checked)}
                          />
                          Obrigatório
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={compDefault}
                            onChange={(e) => setCompDefault(e.target.checked)}
                          />
                          Padrão
                        </label>
                      </div>
                      <div className="mt-3">
                        <label className="mb-1 block text-xs text-zinc-600">Observações</label>
                        <input
                          value={compNotes}
                          onChange={(e) => setCompNotes(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="text-xs text-zinc-600">Destino:</label>
                        <select
                          value={compAddTarget}
                          onChange={(e) => setCompAddTarget(e.target.value as "line" | "product")}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                        >
                          <option value="product">Só neste produto</option>
                          <option value="line">Na linha (todos os produtos da linha)</option>
                        </select>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!lineId}
                            title={
                              lineId ? ADD_TO_LINE_BUTTON_HELP : ADD_TO_LINE_BUTTON_HELP_DISABLED
                            }
                            onClick={() => addComposition("line")}
                            className="rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-950 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Adicionar à linha
                          </button>
                          <CompositionColumnHelp
                            title={
                              lineId ? ADD_TO_LINE_BUTTON_HELP : ADD_TO_LINE_BUTTON_HELP_DISABLED
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => addComposition("product")}
                          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                        >
                          Adicionar só neste produto
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "variants" && (
              <div>
                {mode === "new" ? (
                  <p className="text-sm text-zinc-600">
                    Guarde o produto primeiro. Depois poderá criar e gerir variações neste
                    separador.
                  </p>
                ) : productId ? (
                  <ProductVariantsPanel
                    productId={productId}
                    productKind={productKind}
                    parentSalePriceCents={saleCents}
                    parentCostPriceCents={costCents}
                    variants={initialVariants}
                  />
                ) : null}
              </div>
            )}

            {tab === "fiscal" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">NCM</label>
                  <input
                    value={ncm}
                    onChange={(e) => setNcm(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">CEST</label>
                  <input
                    value={cest}
                    onChange={(e) => setCest(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    CFOP padrão
                  </label>
                  <input
                    value={cfopDefault}
                    onChange={(e) => setCfopDefault(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Origem fiscal
                  </label>
                  <input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Código de barras / EAN
                  </label>
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {tab === "logistics" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Peso (g)</label>
                  <input
                    type="number"
                    min={0}
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Comprimento (cm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Largura (cm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {tab === "media" && (
              <div className="space-y-4 text-sm text-zinc-600">
                <p>
                  O produto guarda o <strong className="font-medium text-zinc-700">id</strong> em{" "}
                  <code className="rounded bg-zinc-100 px-1">document_files</code> (ex.:{" "}
                  <code className="rounded bg-zinc-100 px-1">file_…</code>), não a chave R2. Com
                  produto já gravado, o upload usa{" "}
                  <code className="rounded bg-zinc-100 px-1">products/{"{id}"}/media/…</code>; em
                  novo produto usa-se{" "}
                  <code className="rounded bg-zinc-100 px-1">products/draft/…</code> até existir{" "}
                  <code className="rounded bg-zinc-100 px-1">productId</code>.
                </p>
                <input
                  ref={mainImageFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void handleProductMediaFileSelected(f, "main");
                  }}
                />
                <input
                  ref={galleryImageFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void handleProductMediaFileSelected(f, "gallery");
                  }}
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Imagem principal — ID (
                    <code className="rounded bg-zinc-100 px-1">mainImageFileId</code>)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(mediaUploadKind)}
                      onClick={() => mainImageFileInputRef.current?.click()}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {mediaUploadKind === "main" ? "A enviar…" : "Enviar imagem…"}
                    </button>
                  </div>
                  <input
                    value={mainImageFileId}
                    onChange={(e) => setMainImageFileId(e.target.value)}
                    className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
                    placeholder="file_…"
                  />
                  {isPreviewableProductFileId(mainImageFileId) ? (
                    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="mb-2 text-xs font-medium text-zinc-500">Pré-visualização</p>
                      <img
                        key={mainImageFileId.trim()}
                        src={productFilePreviewSrc(mainImageFileId)}
                        alt="Imagem principal do produto"
                        className="max-h-52 max-w-full rounded-md object-contain"
                      />
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Galeria (<code className="rounded bg-zinc-100 px-1">imagesJson</code>) — um ID
                    por linha
                  </label>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(mediaUploadKind)}
                      onClick={() => galleryImageFileInputRef.current?.click()}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {mediaUploadKind === "gallery" ? "A enviar…" : "Adicionar imagem à galeria…"}
                    </button>
                  </div>
                  <textarea
                    value={galleryFileIdsText}
                    onChange={(e) => setGalleryFileIdsText(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
                    placeholder={"file_abc123\nfile_def456"}
                  />
                  {galleryPreviewIds.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-zinc-500">
                        Pré-visualização da galeria
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {galleryPreviewIds.map((fid, index) => (
                          <div
                            key={`${fid}-${index}`}
                            className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
                          >
                            <img
                              src={productFilePreviewSrc(fid)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">
                    Cada <strong className="font-medium">imagem</strong> ao enviar: JPEG, PNG ou
                    WebP até <strong className="font-medium">5 MB por arquivo</strong> (não é um
                    limite do “tamanho total” da galeria). O limite aplica-se no clique de envio; ao{" "}
                    <strong className="font-medium">Salvar</strong> o produto só vão os IDs (texto),
                    não os binários. Até {MAX_GALLERY_IMAGE_SLOTS} IDs. Colar IDs não refaz upload.
                    Pré-visualização com sessão.
                  </p>
                </div>
              </div>
            )}

            {tab === "history" && (
              <div className="space-y-4 text-sm text-zinc-700">
                <div className="space-y-2">
                  <p>
                    <span className="text-zinc-500">Criado em:</span>{" "}
                    {String(initialProduct.createdAt ?? "—")}
                  </p>
                  <p>
                    <span className="text-zinc-500">Última atualização:</span>{" "}
                    {String(initialProduct.updatedAt ?? "—")}
                  </p>
                </div>
                <div>
                  {mode === "edit" && productId ? (
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await recalculateProductCostSnapshotAction(productId);
                            setSuccess("Snapshot de custo recalculado com sucesso.");
                            router.refresh();
                          } catch (e) {
                            setError(
                              e instanceof Error ? e.message : "Erro ao recalcular snapshot.",
                            );
                          }
                        })
                      }
                      className="mb-3 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Recalcular custo do produto
                    </button>
                  ) : null}
                  <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
                    Auditoria recente
                  </p>
                  {initialAuditLogs.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      Nenhum evento de auditoria registrado para este produto.
                    </p>
                  ) : (
                    <ul className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
                      {initialAuditLogs.map((log) => (
                        <li key={log.id} className="border-b border-zinc-200 pb-2 last:border-0">
                          <div className="flex flex-wrap justify-between gap-2 text-zinc-800">
                            <span className="font-medium">{log.action}</span>
                            <span className="text-zinc-500 tabular-nums">{log.createdAt}</span>
                          </div>
                          <div className="mt-1 text-zinc-600">
                            Ator: {log.actorType}
                            {log.actorId ? ` (${log.actorId})` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
                    Snapshots de custo
                  </p>
                  <div className="mb-3 grid gap-2 sm:grid-cols-4">
                    <select
                      value={snapshotSourceFilter}
                      onChange={(e) => {
                        updateSnapshotQuery({
                          source: e.target.value,
                          page: "1",
                        });
                      }}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                    >
                      <option value="all">Todas as origens</option>
                      {snapshotSources.map((src) => (
                        <option key={src} value={src}>
                          {src}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={snapshotDateFrom}
                      onChange={(e) => {
                        updateSnapshotQuery({ from: e.target.value, page: "1" });
                      }}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      type="date"
                      value={snapshotDateTo}
                      onChange={(e) => {
                        updateSnapshotQuery({ to: e.target.value, page: "1" });
                      }}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateSnapshotQuery({
                          source: "all",
                          from: "",
                          to: "",
                          page: "1",
                        });
                      }}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
                    >
                      Limpar filtros
                    </button>
                  </div>
                  {initialCostSnapshots.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {snapshotTotal === 0
                        ? snapshotSourceFilter !== "all" || snapshotDateFrom || snapshotDateTo
                          ? "Nenhum snapshot encontrado com os filtros atuais."
                          : "Nenhum snapshot de custo registrado para este produto."
                        : "Não há itens nesta página."}
                    </p>
                  ) : (
                    <ul className="max-h-[min(28rem,70vh)] space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs">
                      {initialCostSnapshots.map((s) => {
                        const lines = Array.isArray(s.componentCosts) ? s.componentCosts : [];
                        const expanded = expandedSnapshotId === s.id;
                        return (
                          <li key={s.id} className="border-b border-zinc-200 pb-2 last:border-0">
                            <div className="flex flex-wrap justify-between gap-2 text-zinc-800">
                              <span className="font-medium">{s.source}</span>
                              <span className="text-zinc-500 tabular-nums">{s.snapshotDate}</span>
                            </div>
                            <div className="mt-1 text-zinc-600">
                              Materiais {formatCurrency(s.materialCostCents)} | Embalagem{" "}
                              {formatCurrency(s.packagingCostCents)} | Mão de obra{" "}
                              {formatCurrency(s.laborCostCents)} | Total{" "}
                              <strong className="text-zinc-800">
                                {formatCurrency(s.totalCostCents)}
                              </strong>
                            </div>
                            <div className="mt-2">
                              {lines.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedSnapshotId(expanded ? null : s.id)}
                                  className="text-sky-700 underline hover:text-sky-900"
                                >
                                  {expanded
                                    ? "Ocultar componentes da composição"
                                    : `Ver ${lines.length} linha(s) de componentes`}
                                </button>
                              ) : (
                                <span className="text-zinc-400">
                                  Sem detalhe por componente neste registro (snapshots antigos ou
                                  import manual).
                                </span>
                              )}
                            </div>
                            {expanded && lines.length > 0 ? (
                              <div className="mt-2 overflow-x-auto rounded border border-zinc-200 bg-white">
                                <table className="w-full min-w-[48rem] text-left text-[11px]">
                                  <thead className="border-b border-zinc-200 bg-zinc-50">
                                    <tr>
                                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-zinc-600">
                                        Componente
                                      </th>
                                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-zinc-600">
                                        Tipo do componente
                                      </th>
                                      <th className="px-2 py-1.5 text-right font-semibold whitespace-nowrap text-zinc-600">
                                        <span className="inline-flex items-center justify-end gap-0.5 whitespace-nowrap">
                                          Custo base
                                          <CompositionColumnHelp
                                            title={COMPOSITION_COST_BASE_HEADER_TOOLTIP}
                                          />
                                        </span>
                                      </th>
                                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-zinc-600">
                                        Uso por peça
                                      </th>
                                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-zinc-600">
                                        Canal
                                      </th>
                                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-zinc-600">
                                        Critério
                                      </th>
                                      <th className="px-2 py-1.5 text-right font-semibold text-zinc-600">
                                        <span className="inline-flex items-center justify-end gap-0.5">
                                          <CompositionCalculatedUsageCostHeaderLabel />
                                          <CompositionColumnHelp
                                            title={COMPOSITION_COST_ON_PRODUCT_HEADER_TOOLTIP}
                                          />
                                        </span>
                                      </th>
                                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap text-zinc-600">
                                        Fonte do custo
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((line, idx) => (
                                      <tr
                                        key={line.compositionId ?? `${s.id}-${idx}`}
                                        className="border-b border-zinc-100 text-zinc-700"
                                      >
                                        <td className="px-2 py-1.5 align-top">
                                          <div className="font-medium text-zinc-900">
                                            {line.childName ?? line.childProductId ?? "—"}
                                          </div>
                                          {line.childSku ? (
                                            <div className="font-mono text-zinc-500">
                                              {line.childSku}
                                            </div>
                                          ) : null}
                                          {line.childProductId ? (
                                            <Link
                                              href={`/products/${line.childProductId}`}
                                              className="text-sky-700 underline hover:text-sky-900"
                                            >
                                              Abrir produto
                                            </Link>
                                          ) : null}
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          {line.compositionType ?? "—"}
                                        </td>
                                        <td className="px-2 py-1.5 text-right align-top whitespace-nowrap text-zinc-800 tabular-nums">
                                          {line.unitCost != null ? (
                                            <span className="inline-flex items-center justify-end gap-1">
                                              {compositionCostBaseLabel(
                                                line.unitCost,
                                                line.quantityUnit,
                                              )}
                                              <CompositionColumnHelp
                                                title={snapshotLineCostBaseTooltip(line)}
                                              />
                                            </span>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                        <td className="px-2 py-1.5 align-top whitespace-nowrap text-zinc-800 tabular-nums">
                                          {line.quantity != null
                                            ? compositionUsagePerPieceLabel(
                                                line.quantity,
                                                line.quantityUnit,
                                              )
                                            : "—"}
                                        </td>
                                        <td className="px-2 py-1.5 align-top text-zinc-600">
                                          {line.packagingChannel
                                            ? packagingChannelLabel(line.packagingChannel)
                                            : "—"}
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          {compositionCostBasisLabel(line.unitCostBasis)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right align-top font-medium whitespace-nowrap tabular-nums">
                                          {line.lineTotalCents != null
                                            ? formatCurrency(line.lineTotalCents)
                                            : "—"}
                                        </td>
                                        <td className="px-2 py-1.5 align-top text-zinc-600">
                                          {productCostSourceLabel(line.costSource)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {snapshotTotal > Math.max(1, snapshotLimit) ? (
                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
                      <span>
                        Página {snapshotPage} de {snapshotTotalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={snapshotPage <= 1}
                          onClick={() =>
                            updateSnapshotQuery({ page: String(Math.max(1, snapshotPage - 1)) })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={snapshotPage >= snapshotTotalPages}
                          onClick={() =>
                            updateSnapshotQuery({
                              page: String(Math.min(snapshotTotalPages, snapshotPage + 1)),
                            })
                          }
                          className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:hidden">
            <h3 className="text-sm font-semibold text-zinc-900">Produção</h3>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={producedInternally}
                onChange={(e) => setProducedInternally(e.target.checked)}
              />
              Produzido internamente?
            </label>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">
                Tempo médio de produção (min)
              </label>
              <input
                type="number"
                min={0}
                value={averageProductionTimeMinutes}
                onChange={(e) => setAverageProductionTimeMinutes(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">Mão de obra (R$ / hora)</label>
              <input
                value={laborCostPerHour}
                onChange={(e) => setLaborCostPerHour(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="0,00"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">Notas de produção</label>
              <textarea
                value={productionProfileNotes}
                onChange={(e) => setProductionProfileNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <h3 className="mt-6 text-sm font-semibold text-zinc-900">Canais</h3>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sellable}
                  onChange={(e) => setSellable(e.target.checked)}
                />
                Disponível para venda
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableForEcommerce}
                  onChange={(e) => setAvailableForEcommerce(e.target.checked)}
                />
                E-commerce
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableForPos}
                  onChange={(e) => setAvailableForPos(e.target.checked)}
                />
                PDV
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableForEvents}
                  onChange={(e) => setAvailableForEvents(e.target.checked)}
                />
                Eventos
              </label>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="sticky top-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Resumo</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">SKU</dt>
                <dd className="truncate font-mono text-xs text-zinc-900">{sku || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Status</dt>
                <dd className="text-zinc-800 capitalize">{status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Tipo</dt>
                <dd className="text-right text-xs text-zinc-800">
                  {productType.replace(/_/g, " ")}
                </dd>
              </div>
              {!isSupplyProduct ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Preço venda</dt>
                  <dd className="text-zinc-900 tabular-nums">{formatCurrency(saleCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Custo materiais</dt>
                <dd className="text-zinc-800 tabular-nums">
                  {costBreakdown
                    ? formatCurrency(costBreakdown.materialCostCents)
                    : formatCurrency(0)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Custo online</dt>
                <dd className="text-zinc-800 tabular-nums">
                  {costBreakdown
                    ? formatCurrency(costBreakdown.onlineTotalCostCents)
                    : formatCurrency(costCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Custo presencial</dt>
                <dd className="text-zinc-800 tabular-nums">
                  {costBreakdown
                    ? formatCurrency(costBreakdown.presentialTotalCostCents)
                    : formatCurrency(costCents)}
                </dd>
              </div>
              {!isSupplyProduct ? (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Margem (online)</dt>
                    <dd className="text-emerald-700 tabular-nums">
                      {marginOnlinePct === null ? "—" : `${marginOnlinePct.toFixed(1)}%`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">Margem (presencial)</dt>
                    <dd className="text-emerald-700 tabular-nums">
                      {marginPresentialPct === null ? "—" : `${marginPresentialPct.toFixed(1)}%`}
                    </dd>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Estoque mín.</dt>
                <dd className="tabular-nums">{minStock || "0"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Vendável?</dt>
                <dd>{sellable ? "Sim" : "Não"}</dd>
              </div>
            </dl>
          </div>

          <div className="hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-sm md:block">
            <h2 className="text-sm font-semibold text-zinc-900">Produção & canais</h2>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={producedInternally}
                onChange={(e) => setProducedInternally(e.target.checked)}
              />
              Produzido internamente
            </label>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">Tempo médio produção (min)</label>
              <input
                type="number"
                min={0}
                value={averageProductionTimeMinutes}
                onChange={(e) => setAverageProductionTimeMinutes(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">Mão de obra (R$ / hora)</label>
              <input
                value={laborCostPerHour}
                onChange={(e) => setLaborCostPerHour(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                placeholder="0,00"
              />
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-zinc-600">Notas de produção</label>
              <textarea
                value={productionProfileNotes}
                onChange={(e) => setProductionProfileNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sellable}
                  onChange={(e) => setSellable(e.target.checked)}
                />
                Disponível para venda
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableForEcommerce}
                  onChange={(e) => setAvailableForEcommerce(e.target.checked)}
                />
                E-commerce
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableForPos}
                  onChange={(e) => setAvailableForPos(e.target.checked)}
                />
                PDV
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableForEvents}
                  onChange={(e) => setAvailableForEvents(e.target.checked)}
                />
                Eventos
              </label>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
