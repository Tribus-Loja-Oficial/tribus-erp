import { ProductOperationalForm } from "@/components/products/product-operational-form";
import type { VariantApiRow } from "@/components/products/product-variants-panel";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import type {
  CompositionRow,
  ProductCostBreakdown,
  ProductAuditLogRow,
  ProductCostSnapshotRow,
  ProductStockMovementRow,
  ProductPurchaseReceiptHistoryRow,
  ProductBomParentRow,
} from "@/components/products/product-operational-form";
import { notFound } from "next/navigation";

interface CategoryRow {
  id: string;
  name: string;
}

interface CollectionRow {
  id: string;
  name: string;
}

interface LocationRow {
  id: string;
  name: string;
}

interface OperationalDetail {
  product: Record<string, unknown>;
  compositions?: CompositionRow[];
  costBreakdown?: ProductCostBreakdown | null;
  variants?: VariantApiRow[];
  stockMovements?: ProductStockMovementRow[];
  purchaseReceiptHistory?: ProductPurchaseReceiptHistoryRow[];
  bomParents?: ProductBomParentRow[];
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    source?: string;
    from?: string;
    to?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  let detail: OperationalDetail | null = null;
  let categories: CategoryRow[] = [];
  let collections: CollectionRow[] = [];
  let locations: LocationRow[] = [];

  try {
    const [dRes, cRes, colRes, locRes] = await Promise.all([
      erpApiFetch<{ data: OperationalDetail }>({ path: `/products/${id}/detail` }),
      erpApiFetch<{ data: CategoryRow[] }>({ path: "/products/categories" }),
      erpApiFetch<{ data: CollectionRow[] }>({ path: "/products/collections" }),
      erpApiFetch<{ data: LocationRow[] }>({ path: "/inventory/locations" }),
    ]);
    detail = dRes.data;
    categories = cRes.data ?? [];
    collections = colRes.data ?? [];
    locations = locRes.data ?? [];
  } catch {
    notFound();
  }

  if (!detail?.product) notFound();

  let auditLogs: ProductAuditLogRow[] = [];
  let costSnapshots: ProductCostSnapshotRow[] = [];
  let costSnapshotsMeta = { total: 0, page: 1, limit: 10 };
  const snapshotSource = sp.source?.trim() || "all";
  const snapshotFrom = sp.from?.trim() || "";
  const snapshotTo = sp.to?.trim() || "";
  const snapshotPage = Number(sp.page ?? "1");
  const snapshotLimit = Number(sp.limit ?? "10");
  try {
    const aRes = await erpApiFetch<{ data: ProductAuditLogRow[] }>({
      path: `/products/${id}/audit`,
    });
    auditLogs = aRes.data ?? [];
  } catch {
    auditLogs = [];
  }
  try {
    const sRes = await erpApiFetch<{
      data: ProductCostSnapshotRow[];
      meta?: { total: number; page: number; limit: number };
    }>({
      path: `/products/${id}/cost-snapshots`,
      searchParams: {
        source: snapshotSource !== "all" ? snapshotSource : undefined,
        from: snapshotFrom || undefined,
        to: snapshotTo || undefined,
        page: Number.isFinite(snapshotPage) ? Math.max(1, snapshotPage) : 1,
        limit: Number.isFinite(snapshotLimit) ? Math.max(1, snapshotLimit) : 10,
      },
    });
    costSnapshots = sRes.data ?? [];
    if (sRes.meta) costSnapshotsMeta = sRes.meta;
  } catch {
    costSnapshots = [];
    costSnapshotsMeta = { total: 0, page: 1, limit: 10 };
  }

  return (
    <div className="flex flex-col overflow-auto bg-zinc-50">
      <ProductOperationalForm
        mode="edit"
        productId={id}
        initialProduct={detail.product}
        initialCompositions={detail.compositions ?? []}
        initialVariants={detail.variants ?? []}
        costBreakdown={detail.costBreakdown ?? null}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initialAuditLogs={auditLogs}
        initialCostSnapshots={costSnapshots}
        snapshotSourceFilter={snapshotSource}
        snapshotDateFrom={snapshotFrom}
        snapshotDateTo={snapshotTo}
        snapshotPage={costSnapshotsMeta.page}
        snapshotLimit={costSnapshotsMeta.limit}
        snapshotTotal={costSnapshotsMeta.total}
        initialStockMovements={detail.stockMovements ?? []}
        initialPurchaseReceiptHistory={detail.purchaseReceiptHistory ?? []}
        initialBomParents={detail.bomParents ?? []}
      />
    </div>
  );
}
