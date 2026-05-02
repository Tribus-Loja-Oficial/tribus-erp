import { ProductOperationalForm } from "@/components/products/product-operational-form";
import { erpApiFetch } from "@/lib/api/erp-api-client";

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

export default async function NewProductPage() {
  let categories: CategoryRow[] = [];
  let collections: CollectionRow[] = [];
  let locations: LocationRow[] = [];

  try {
    const [cRes, colRes, locRes] = await Promise.all([
      erpApiFetch<{ data: CategoryRow[] }>({ path: "/products/categories" }),
      erpApiFetch<{ data: CollectionRow[] }>({ path: "/products/collections" }),
      erpApiFetch<{ data: LocationRow[] }>({ path: "/inventory/locations" }),
    ]);
    categories = cRes.data ?? [];
    collections = colRes.data ?? [];
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
        }}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}
