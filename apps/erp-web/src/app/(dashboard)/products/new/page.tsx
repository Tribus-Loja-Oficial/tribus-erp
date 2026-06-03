import { ProductOperationalForm } from "@/components/products/product-operational-form";
import { erpApiFetch } from "@/lib/api/erp-api-client";

interface CategoryRow {
  id: string;
  name: string;
}

interface LineRow {
  id: string;
  name: string;
}

interface LocationRow {
  id: string;
  name: string;
}

export default async function NewProductPage() {
  let categories: CategoryRow[] = [];
  let lines: LineRow[] = [];
  let locations: LocationRow[] = [];

  try {
    const [cRes, colRes, locRes] = await Promise.all([
      erpApiFetch<{ data: CategoryRow[] }>({ path: "/products/categories" }),
      erpApiFetch<{ data: LineRow[] }>({ path: "/products/lines" }),
      erpApiFetch<{ data: LocationRow[] }>({ path: "/inventory/locations" }),
    ]);
    categories = cRes.data ?? [];
    lines = colRes.data ?? [];
    locations = locRes.data ?? [];
  } catch {
    /* formulário ainda funciona com listas vazias */
  }

  return (
    <div className="flex flex-col overflow-auto bg-zinc-50">
      <ProductOperationalForm
        mode="new"
        initialProduct={{
          sku: "",
          name: "",
          productType: "finished_product",
          status: "draft",
          unitOfMeasure: "unit",
          salePriceCents: 0,
          costPriceCents: 0,
          minStock: 0,
          controlsStock: true,
          sellable: true,
          availableForEcommerce: true,
          availableForPos: true,
          availableForEvents: false,
          producedInternally: false,
          origin: "0",
          productKind: "simple",
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        lines={lines.map((c) => ({ id: c.id, name: c.name }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}
