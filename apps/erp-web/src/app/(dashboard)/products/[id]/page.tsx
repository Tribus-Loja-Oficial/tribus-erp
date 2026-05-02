import { ProductOperationalForm } from "@/components/products/product-operational-form";
import { erpApiFetch } from "@/lib/api/erp-api-client";
import type {
  CompositionRow,
  CostEstimate,
  ProductAuditLogRow,
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
  costEstimate?: CostEstimate | null;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
  try {
    const aRes = await erpApiFetch<{ data: ProductAuditLogRow[] }>({
      path: `/products/${id}/audit`,
    });
    auditLogs = aRes.data ?? [];
  } catch {
    auditLogs = [];
  }

  return (
    <div className="flex flex-col overflow-auto bg-zinc-50">
      <ProductOperationalForm
        mode="edit"
        productId={id}
        initialProduct={detail.product}
        initialCompositions={detail.compositions ?? []}
        costEstimate={detail.costEstimate ?? null}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initialAuditLogs={auditLogs}
      />
    </div>
  );
}
