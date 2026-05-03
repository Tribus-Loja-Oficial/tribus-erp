"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  addProductCompositionAction,
  createProductOperationalAction,
  removeProductCompositionAction,
  updateProductCompositionAction,
  updateProductOperationalAction,
} from "@/server/product-operational-actions";
import type { UploadedProductMediaRow } from "@/lib/product-media-types";
import { CompositionProductPicker } from "@/components/products/composition-product-picker";

export interface SelectOption {
  id: string;
  name: string;
}

export interface CompositionRow {
  id: string;
  childProductId: string;
  compositionType: string;
  quantity: number;
  required: boolean;
  isDefault: boolean;
  notes: string | null;
  childSku?: string | null;
  childName?: string | null;
  lineCostCents?: number;
}

export interface CostEstimate {
  baseCostCents: number;
  bomCostCents: number;
  packagingCostCents: number;
  kitCostCents: number;
  bundleCostCents: number;
  otherCompositionCostCents: number;
  totalEstimatedCostCents: number;
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

type TabId =
  | "general"
  | "prices"
  | "stock"
  | "composition"
  | "fiscal"
  | "logistics"
  | "media"
  | "history";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "Geral" },
  { id: "prices", label: "Preços" },
  { id: "stock", label: "Estoque" },
  { id: "composition", label: "Composição" },
  { id: "fiscal", label: "Fiscal" },
  { id: "logistics", label: "Logística" },
  { id: "media", label: "Mídia / Arquivos" },
  { id: "history", label: "Histórico" },
];

const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "finished_product", label: "Produto final (venda ao cliente)" },
  { value: "raw_material", label: "Matéria-prima" },
  { value: "packaging", label: "Embalagem / insumo operacional" },
  { value: "kit", label: "Kit (montagem)" },
  { value: "bundle", label: "Bundle (agrupamento)" },
  { value: "service", label: "Serviço" },
  { value: "consumable", label: "Consumível interno" },
];

const COMPOSITION_TYPES: { value: string; label: string }[] = [
  { value: "packaging", label: "Embalagem" },
  { value: "bom", label: "BOM / ficha técnica" },
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

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function inputToCents(raw: string): number {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function pctMargin(saleCents: number, totalCostCents: number): number | null {
  if (saleCents <= 0) return null;
  return ((saleCents - totalCostCents) / saleCents) * 100;
}

function markup(saleCents: number, totalCostCents: number): number | null {
  if (totalCostCents <= 0) return null;
  return saleCents / totalCostCents;
}

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

const PRODUCT_FILE_ID_RE = /^file_[a-f0-9]{32}$/i;

function isPreviewableProductFileId(raw: string): boolean {
  return PRODUCT_FILE_ID_RE.test(raw.trim());
}

function productFilePreviewSrc(fileId: string): string {
  return `/api/product-files/${encodeURIComponent(fileId.trim())}`;
}

/** Mesma lógica para textarea da galeria, preview e payload (incl. `\r\n` do Windows). */
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
  costEstimate?: CostEstimate | null;
  categories: SelectOption[];
  collections: SelectOption[];
  locations: SelectOption[];
  initialAuditLogs?: ProductAuditLogRow[];
}

export function ProductOperationalForm({
  mode,
  productId,
  initialProduct,
  initialCompositions = [],
  costEstimate,
  categories,
  collections,
  locations,
  initialAuditLogs = [],
}: ProductOperationalFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("general");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mainImageFileInputRef = useRef<HTMLInputElement>(null);
  const galleryImageFileInputRef = useRef<HTMLInputElement>(null);
  const [mediaUploadKind, setMediaUploadKind] = useState<"main" | "gallery" | null>(null);

  const [sku, setSku] = useState(String(initialProduct.sku ?? ""));
  const [name, setName] = useState(String(initialProduct.name ?? ""));
  const [internalName, setInternalName] = useState(String(initialProduct.internalName ?? ""));
  const [productType, setProductType] = useState(
    String(initialProduct.productType ?? "finished_product"),
  );
  const [status, setStatus] = useState(String(initialProduct.status ?? "draft"));
  const [categoryId, setCategoryId] = useState(String(initialProduct.categoryId ?? ""));
  const [collectionId, setCollectionId] = useState(String(initialProduct.collectionId ?? ""));
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
  const [compType, setCompType] = useState("packaging");
  const [compQty, setCompQty] = useState("1");
  const [compRequired, setCompRequired] = useState(true);
  const [compDefault, setCompDefault] = useState(true);
  const [compNotes, setCompNotes] = useState("");

  const [editCompId, setEditCompId] = useState<string | null>(null);
  const [editCompChildId, setEditCompChildId] = useState("");
  const [editCompType, setEditCompType] = useState("packaging");
  const [editCompQty, setEditCompQty] = useState("1");
  const [editCompRequired, setEditCompRequired] = useState(true);
  const [editCompDefault, setEditCompDefault] = useState(true);
  const [editCompNotes, setEditCompNotes] = useState("");

  const saleCents = useMemo(() => inputToCents(salePrice), [salePrice]);
  const costCents = useMemo(() => inputToCents(costPrice), [costPrice]);

  const estimatedTotalCost = useMemo(() => {
    if (costEstimate) return costEstimate.totalEstimatedCostCents;
    return costCents;
  }, [costEstimate, costCents]);

  const marginPct = pctMargin(saleCents, estimatedTotalCost);
  const markupVal = markup(saleCents, estimatedTotalCost);

  const compositionSumLines = useMemo(
    () => initialCompositions.reduce((acc, r) => acc + (r.lineCostCents ?? 0), 0),
    [initialCompositions],
  );

  const compositionFromEstimate = useMemo(() => {
    if (!costEstimate) return null;
    return (
      costEstimate.bomCostCents +
      costEstimate.packagingCostCents +
      costEstimate.kitCostCents +
      costEstimate.bundleCostCents +
      costEstimate.otherCompositionCostCents
    );
  }, [costEstimate]);

  function buildPayload(): Record<string, unknown> {
    const galleryLines = parseGalleryFileIdLines(galleryFileIdsText);

    const payload: Record<string, unknown> = {
      sku: sku.trim(),
      name: name.trim(),
      internalName: internalName.trim() || undefined,
      productType,
      status,
      categoryId: categoryId || undefined,
      collectionId: collectionId || undefined,
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
      controlsStock,
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
      sellable,
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
          if (navigateAfter === "list") router.push("/products");
          else router.push(`/products/${id}`);
          router.refresh();
        } else if (productId) {
          await updateProductOperationalAction(productId, payload);
          setSuccess("Alterações salvas.");
          router.refresh();
          if (navigateAfter === "list") router.push("/products");
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
          `Resposta inválida do servidor (HTTP ${res.status}). Se o ficheiro é grande, pode ser limite da infraestrutura (ex.: Vercel).`,
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
        throw new Error("Resposta inválida: a API não devolveu os dados do ficheiro.");
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

  async function addComposition() {
    if (!productId) return;
    setError(null);
    try {
      const qty = Number(compQty.replace(",", "."));
      if (!compChildId || !(qty > 0)) {
        setError("Selecione o componente e informe quantidade > 0.");
        return;
      }
      await addProductCompositionAction(productId, {
        childProductId: compChildId,
        quantity: qty,
        compositionType: compType,
        required: compRequired,
        isDefault: compDefault,
        notes: compNotes.trim() || undefined,
      });
      setCompChildId("");
      setCompQty("1");
      setCompNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar composição");
    }
  }

  async function removeComposition(compId: string) {
    if (!productId) return;
    setError(null);
    try {
      await removeProductCompositionAction(productId, compId);
      if (editCompId === compId) setEditCompId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  function startEditComposition(row: CompositionRow) {
    setEditCompId(row.id);
    setEditCompChildId(row.childProductId);
    setEditCompType(row.compositionType);
    setEditCompQty(String(row.quantity));
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
      await updateProductCompositionAction(productId, editCompId, {
        childProductId: editCompChildId,
        compositionType: editCompType,
        quantity: qty,
        required: editCompRequired,
        isDefault: editCompDefault,
        notes: editCompNotes.trim() || undefined,
      });
      setEditCompId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar composição");
    }
  }

  const packagingHint =
    productType === "packaging"
      ? "Este cadastro representa uma embalagem ou insumo operacional com estoque e custo próprios."
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <nav className="mb-2 text-sm text-zinc-500">
        <Link href="/products" className="hover:text-zinc-800">
          Produtos
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-800">{mode === "new" ? "Novo produto" : sku || "Editar"}</span>
      </nav>

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
            Salvar e voltar
          </button>
          <Link
            href="/products"
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancelar
          </Link>
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
            {TABS.map((t) => (
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
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Coleção</label>
                  <select
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {collections.map((c) => (
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
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Custo base (R$)
                    </label>
                    <input
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
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
                </div>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
                  <p className="font-medium text-zinc-800">Custo total estimado</p>
                  <p className="mt-1 text-zinc-600">
                    {formatCurrency(estimatedTotalCost)} — considera custo base
                    {costEstimate
                      ? " + composições (BOM, embalagens, outros)."
                      : " (composições após salvar e recarregar)."}
                  </p>
                  {costEstimate && (
                    <ul className="mt-2 grid gap-1 text-xs text-zinc-500 sm:grid-cols-2">
                      <li>Base: {formatCurrency(costEstimate.baseCostCents)}</li>
                      <li>BOM: {formatCurrency(costEstimate.bomCostCents)}</li>
                      <li>Embalagens: {formatCurrency(costEstimate.packagingCostCents)}</li>
                      <li>Kits: {formatCurrency(costEstimate.kitCostCents)}</li>
                      <li>Bundles: {formatCurrency(costEstimate.bundleCostCents)}</li>
                      <li>
                        Outros (acessório/incluso):{" "}
                        {formatCurrency(costEstimate.otherCompositionCostCents)}
                      </li>
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-zinc-200 pt-3 text-zinc-800">
                    <span>
                      Margem:{" "}
                      <strong>{marginPct === null ? "—" : `${marginPct.toFixed(1)}%`}</strong>
                    </span>
                    <span>
                      Markup:{" "}
                      <strong>{markupVal === null ? "—" : `${markupVal.toFixed(2)}×`}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === "stock" && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={controlsStock}
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
                <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 md:col-span-2">
                  Em breve: estoque atual, reservado, disponível e últimas movimentações (via módulo
                  de estoque).
                </div>
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
                    <div className="overflow-x-auto rounded-lg border border-zinc-200">
                      <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 uppercase">
                          <tr>
                            <th className="px-3 py-2">Componente</th>
                            <th className="px-3 py-2">Tipo</th>
                            <th className="px-3 py-2 text-right">Qtd</th>
                            <th className="px-3 py-2 text-right">Custo linha</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {initialCompositions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                                Nenhuma composição cadastrada.
                              </td>
                            </tr>
                          ) : (
                            initialCompositions.map((row) =>
                              editCompId === row.id ? (
                                <tr key={row.id} className="border-b border-zinc-100 bg-zinc-50">
                                  <td colSpan={5} className="px-3 py-4">
                                    <p className="mb-3 text-xs font-semibold text-zinc-700">
                                      Editar linha de composição
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
                                          Tipo de composição
                                        </label>
                                        <select
                                          value={editCompType}
                                          onChange={(e) => setEditCompType(e.target.value)}
                                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                        >
                                          {COMPOSITION_TYPES.map((c) => (
                                            <option key={c.value} value={c.value}>
                                              {c.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs text-zinc-600">
                                          Quantidade
                                        </label>
                                        <input
                                          value={editCompQty}
                                          onChange={(e) => setEditCompQty(e.target.value)}
                                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-4">
                                      <label className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={editCompRequired}
                                          onChange={(e) => setEditCompRequired(e.target.checked)}
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
                                <tr key={row.id} className="border-b border-zinc-100">
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-zinc-900">
                                      {row.childName ?? row.childProductId}
                                    </div>
                                    <div className="font-mono text-xs text-zinc-500">
                                      {row.childSku}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-zinc-700 capitalize">
                                    {row.compositionType}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {row.quantity}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {formatCurrency(row.lineCostCents ?? 0)}
                                  </td>
                                  <td className="space-x-3 px-3 py-2 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => startEditComposition(row)}
                                      className="text-xs text-zinc-600 underline hover:text-zinc-900"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeComposition(row.id)}
                                      className="text-xs text-red-600 hover:underline"
                                    >
                                      Remover
                                    </button>
                                  </td>
                                </tr>
                              ),
                            )
                          )}
                        </tbody>
                        {initialCompositions.length > 0 ? (
                          <tfoot>
                            <tr className="border-t border-zinc-200 bg-zinc-50 font-medium text-zinc-800">
                              <td
                                colSpan={3}
                                className="px-3 py-2 text-right text-xs font-semibold tracking-wide text-zinc-600 uppercase"
                              >
                                Soma das linhas
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatCurrency(compositionSumLines)}
                              </td>
                              <td />
                            </tr>
                            {costEstimate != null && compositionFromEstimate != null ? (
                              <tr className="bg-zinc-50 text-xs text-zinc-600">
                                <td colSpan={5} className="px-3 pt-0 pb-3">
                                  Composição no custo estimado (sem base):{" "}
                                  <span className="font-semibold text-zinc-800 tabular-nums">
                                    {formatCurrency(compositionFromEstimate)}
                                  </span>
                                  {Math.abs(compositionFromEstimate - compositionSumLines) > 1 ? (
                                    <span className="ml-2 text-amber-800">
                                      Diferente da soma das linhas — revise custos dos componentes
                                      ou recarregue após alterações.
                                    </span>
                                  ) : null}
                                </td>
                              </tr>
                            ) : null}
                          </tfoot>
                        ) : null}
                      </table>
                    </div>
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
                          <label className="mb-1 block text-xs text-zinc-600">Tipo</label>
                          <select
                            value={compType}
                            onChange={(e) => setCompType(e.target.value)}
                            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          >
                            {COMPOSITION_TYPES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-600">Quantidade</label>
                          <input
                            value={compQty}
                            onChange={(e) => setCompQty(e.target.value)}
                            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          />
                        </div>
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
                      <button
                        type="button"
                        onClick={() => addComposition()}
                        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                      >
                        Adicionar à composição
                      </button>
                    </div>
                  </>
                )}
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
                    Cada envio: JPEG, PNG ou WebP até <strong className="font-medium">5 MB</strong>{" "}
                    (validado no servidor). Até {MAX_GALLERY_IMAGE_SLOTS} IDs na galeria. Colar IDs
                    na caixa não faz novo upload — só referencia ficheiros já existentes. A
                    pré-visualização exige sessão iniciada.
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
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Preço venda</dt>
                <dd className="text-zinc-900 tabular-nums">{formatCurrency(saleCents)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Custo estimado</dt>
                <dd className="text-zinc-800 tabular-nums">{formatCurrency(estimatedTotalCost)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500">Margem</dt>
                <dd className="text-emerald-700 tabular-nums">
                  {marginPct === null ? "—" : `${marginPct.toFixed(1)}%`}
                </dd>
              </div>
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
