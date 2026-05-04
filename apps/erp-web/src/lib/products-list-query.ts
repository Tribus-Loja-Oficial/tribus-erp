/** Chaves de query string alinhadas com `GET /products` (listProductsSchema). */

export const DEFAULT_PRODUCT_LIST_LIMIT = 25;

export type ProductListQuery = {
  q?: string;
  status?: string;
  productType?: string;
  stockFilter?: string;
  channel?: string;
  sortField?: string;
  sortDir?: string;
  page: number;
  limit: number;
};

function parseIntParam(v: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseProductListSearchParams(
  sp: Record<string, string | string[] | undefined>,
): ProductListQuery {
  const str = (k: string) => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0]?.trim() || undefined;
    return typeof v === "string" ? v.trim() || undefined : undefined;
  };

  const limitRaw = parseIntParam(sp.limit, DEFAULT_PRODUCT_LIST_LIMIT);
  const limit = [10, 25, 50].includes(limitRaw) ? limitRaw : DEFAULT_PRODUCT_LIST_LIMIT;

  const sf = str("sortField");
  const sd = str("sortDir");
  return {
    q: str("q"),
    status: str("status"),
    productType: str("productType"),
    stockFilter: str("stockFilter"),
    channel: str("channel"),
    sortField: sf || undefined,
    sortDir: sd || undefined,
    page: parseIntParam(sp.page, 1),
    limit,
  };
}

export function productListQueryToApiParams(q: ProductListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {
    page: q.page,
    limit: q.limit,
  };
  if (q.q) out.q = q.q;
  if (q.status) out.status = q.status;
  if (q.productType) out.productType = q.productType;
  if (q.stockFilter) out.stockFilter = q.stockFilter;
  if (q.channel) out.channel = q.channel;
  if (q.sortField) out.sortField = q.sortField;
  if (q.sortDir) out.sortDir = q.sortDir;
  return out;
}
