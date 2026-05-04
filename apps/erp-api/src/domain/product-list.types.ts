/** Filtros da listagem operacional de produtos (API + repositório). */
export type ProductListStockFilter = "in_stock" | "out_of_stock" | "below_min" | "not_controlled";

export type ProductListProductKindFilter = "simple" | "variable";

export type ProductListChannelFilter = "sellable" | "ecommerce" | "pos" | "events";

export type ProductListSortField =
  | "sku"
  | "externalRef"
  | "name"
  | "type"
  | "status"
  | "salePrice"
  | "stock"
  | "updatedAt";
