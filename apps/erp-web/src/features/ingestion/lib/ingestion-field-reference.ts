/** Obrigatório no objeto | em `data` | condicional. */
export type FieldRequirement = "required" | "optional" | "conditional";

export type IngestionFieldRow = {
  key: string;
  requirement: FieldRequirement;
  condition?: string;
  valueType: string;
  enumValues?: readonly string[];
  default?: string;
  maxLength?: number;
  hint?: string;
};

export type IngestionObjectTypeId =
  | "stock_location"
  | "category"
  | "collection"
  | "party"
  | "customer"
  | "supplier"
  | "product"
  | "product_variant"
  | "product_composition"
  | "inventory_movement"
  | "order"
  | "purchase_order";

export type IngestionTypeReference = {
  type: IngestionObjectTypeId;
  summary: string;
  envelope: Array<{ key: string; requirement: FieldRequirement; hint?: string }>;
  dataFields: IngestionFieldRow[];
};

export const INGESTION_ENVELOPE_META = {
  objects: {
    hint: "array 1–200 de { type, client_ref?, data }",
  },
};

const envCommon: IngestionTypeReference["envelope"] = [
  { key: "type", requirement: "required", hint: "literal do tipo (ex.: product)" },
  {
    key: "action",
    requirement: "optional",
    hint:
      '"skip" (default): insere se não existe, ignora se existe. ' +
      '"upsert": actualiza campos enviados se existe (merge-patch), cria se não existe. ' +
      "Suporte a upsert: category (chave: slug), collection (chave: slug), product (chave: slug ou sku). " +
      "Outros tipos: campo aceite mas ignorado.",
  },
  { key: "client_ref", requirement: "optional", hint: "único no payload; use *Ref nos filhos" },
  { key: "data", requirement: "required", hint: "campos em camelCase (API ERP)" },
];

export const INGESTION_TYPE_LABELS_UI: Record<IngestionObjectTypeId, string> = {
  stock_location: "Local de stock",
  category: "Categoria",
  collection: "Coleção",
  party: "Entidade (party)",
  customer: "Cliente",
  supplier: "Fornecedor",
  product: "Produto",
  product_variant: "Variante",
  product_composition: "Composição (BOM/embalagem)",
  inventory_movement: "Movimento de stock",
  order: "Pedido",
  purchase_order: "Ordem de compra",
};

export const INGESTION_TYPE_REFERENCES: IngestionTypeReference[] = [
  {
    type: "stock_location",
    summary: "Armazém ou local (POST /inventory/locations).",
    envelope: envCommon,
    dataFields: [
      { key: "name", requirement: "required", valueType: "string", maxLength: 100 },
      {
        key: "type",
        requirement: "required",
        valueType: "enum",
        enumValues: ["main", "event", "production", "damaged", "reserved", "third_party"],
      },
      { key: "address", requirement: "optional", valueType: "string" },
    ],
  },
  {
    type: "category",
    summary: "Categoria de produto.",
    envelope: envCommon,
    dataFields: [
      { key: "name", requirement: "required", valueType: "string" },
      { key: "slug", requirement: "required", valueType: "string" },
      { key: "parentId", requirement: "optional", valueType: "string", hint: "ID real" },
      {
        key: "parentCategoryRef",
        requirement: "optional",
        valueType: "string",
        hint: "client_ref de category no mesmo payload",
      },
      { key: "description", requirement: "optional", valueType: "string" },
    ],
  },
  {
    type: "collection",
    summary: "Coleção de produtos.",
    envelope: envCommon,
    dataFields: [
      { key: "name", requirement: "required", valueType: "string" },
      { key: "slug", requirement: "required", valueType: "string" },
      { key: "description", requirement: "optional", valueType: "string" },
      { key: "niche", requirement: "optional", valueType: "string" },
      { key: "season", requirement: "optional", valueType: "string" },
      {
        key: "status",
        requirement: "optional",
        valueType: "enum",
        enumValues: ["draft", "active", "archived"],
        default: "active",
      },
    ],
  },
  {
    type: "party",
    summary: "Pessoa jurídica ou física base (sem perfil cliente/fornecedor).",
    envelope: envCommon,
    dataFields: [
      {
        key: "type",
        requirement: "required",
        valueType: "enum",
        enumValues: ["individual", "company"],
      },
      { key: "legalName", requirement: "required", valueType: "string" },
      { key: "tradeName", requirement: "optional", valueType: "string" },
      {
        key: "documentType",
        requirement: "optional",
        valueType: "enum",
        enumValues: ["cpf", "cnpj", "foreign", "unknown"],
        default: "unknown",
      },
      { key: "documentNumber", requirement: "optional", valueType: "string" },
      { key: "email", requirement: "optional", valueType: "string (email)" },
      { key: "phone", requirement: "optional", valueType: "string" },
    ],
  },
  {
    type: "customer",
    summary: "Party + registo de cliente.",
    envelope: envCommon,
    dataFields: [
      {
        key: "legalName",
        requirement: "required",
        valueType: "string",
        hint: "mesmos campos que party",
      },
      {
        key: "origin",
        requirement: "optional",
        valueType: "enum",
        enumValues: ["ecommerce", "event", "manual", "imported"],
      },
    ],
  },
  {
    type: "supplier",
    summary: "Party + registo de fornecedor.",
    envelope: envCommon,
    dataFields: [
      { key: "legalName", requirement: "required", valueType: "string" },
      { key: "stateRegistration", requirement: "optional", valueType: "string" },
      { key: "contactName", requirement: "optional", valueType: "string" },
    ],
  },
  {
    type: "product",
    summary:
      "Produto; categoryRef/collectionRef ligam a client_ref no mesmo payload. Variações exigem productKind variable neste product.",
    envelope: envCommon,
    dataFields: [
      { key: "sku", requirement: "required", valueType: "string" },
      { key: "name", requirement: "required", valueType: "string" },
      {
        key: "productKind",
        requirement: "optional",
        valueType: "enum",
        enumValues: ["simple", "variable"],
      },
      {
        key: "productType",
        requirement: "required",
        valueType: "enum",
        enumValues: [
          "finished_product",
          "raw_material",
          "packaging",
          "kit",
          "bundle",
          "service",
          "consumable",
        ],
      },
      { key: "salePriceCents", requirement: "required", valueType: "number (int)" },
      { key: "categoryRef", requirement: "optional", valueType: "string" },
      { key: "collectionRef", requirement: "optional", valueType: "string" },
      { key: "main_image_url", requirement: "optional", valueType: "https URL" },
      { key: "gallery_image_urls", requirement: "optional", valueType: "string[]" },
    ],
  },
  {
    type: "product_variant",
    summary:
      "Variante; productRef → client_ref de product com productKind variable. Recomendado client_ref na variante para variantRef em stock/pedidos.",
    envelope: envCommon,
    dataFields: [
      { key: "productRef", requirement: "required", valueType: "string" },
      { key: "sku", requirement: "required", valueType: "string" },
      {
        key: "attributes",
        requirement: "optional",
        valueType: "record<string,string> (omissão = {})",
      },
      { key: "name", requirement: "optional", valueType: "string" },
      { key: "salePriceCents", requirement: "optional", valueType: "number" },
    ],
  },
  {
    type: "product_composition",
    summary: "Linha BOM/embalagem; parentProductRef; childProductRef ou childSku.",
    envelope: envCommon,
    dataFields: [
      { key: "parentProductRef", requirement: "required", valueType: "string" },
      {
        key: "childProductRef",
        requirement: "conditional",
        condition: "ou childSku",
        valueType: "string",
      },
      {
        key: "childSku",
        requirement: "conditional",
        condition: "ou childProductRef",
        valueType: "string",
      },
      { key: "quantity", requirement: "required", valueType: "number > 0" },
      {
        key: "compositionType",
        requirement: "required",
        valueType: "enum",
        enumValues: ["packaging", "bom", "kit", "bundle", "accessory", "included"],
      },
    ],
  },
  {
    type: "inventory_movement",
    summary:
      "Movimento; productRef/locationRef ou IDs. Se productRef for produto variable no mesmo payload: variantId ou variantRef (client_ref de product_variant).",
    envelope: envCommon,
    dataFields: [
      {
        key: "productRef",
        requirement: "conditional",
        condition: "se não productId",
        valueType: "string",
      },
      {
        key: "productId",
        requirement: "conditional",
        condition: "se não productRef",
        valueType: "string",
      },
      {
        key: "variantRef",
        requirement: "conditional",
        condition: "produto variable por productRef no lote (senão variantId)",
        valueType: "string",
      },
      {
        key: "variantId",
        requirement: "conditional",
        condition: "alternativa a variantRef",
        valueType: "string",
      },
      {
        key: "locationRef",
        requirement: "conditional",
        condition: "se não locationId",
        valueType: "string",
      },
      {
        key: "locationId",
        requirement: "conditional",
        condition: "se não locationRef",
        valueType: "string",
      },
      {
        key: "type",
        requirement: "required",
        valueType: "enum",
        enumValues: ["purchase", "sale", "adjustment", "transfer_in", "transfer_out", "…"],
      },
      { key: "quantity", requirement: "required", valueType: "int ≥ 1" },
    ],
  },
  {
    type: "order",
    summary:
      "Pedido; customerRef ou customerId. Linhas com productRef a produto variable no lote: variantId ou variantRef.",
    envelope: envCommon,
    dataFields: [
      {
        key: "customerRef",
        requirement: "conditional",
        condition: "se não customerId",
        valueType: "string",
      },
      {
        key: "items",
        requirement: "required",
        valueType:
          "array (sku, name, quantity, unitPriceCents, productRef?, productId?, variantRef?, variantId?, …)",
      },
    ],
  },
  {
    type: "purchase_order",
    summary: "OC; supplierRef ou supplierId.",
    envelope: envCommon,
    dataFields: [
      {
        key: "supplierRef",
        requirement: "conditional",
        condition: "se não supplierId",
        valueType: "string",
      },
      { key: "issueDate", requirement: "required", valueType: "YYYY-MM-DD" },
      { key: "items", requirement: "required", valueType: "array" },
    ],
  },
];

export function ingestionSupportedTypesFooter(): string {
  return INGESTION_TYPE_REFERENCES.map((t) => INGESTION_TYPE_LABELS_UI[t.type]).join(", ");
}
