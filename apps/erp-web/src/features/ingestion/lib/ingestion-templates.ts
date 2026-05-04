export type IngestionTemplate = {
  id: string;
  label: string;
  description: string;
  payload: object;
};

export const INGESTION_TEMPLATES: IngestionTemplate[] = [
  {
    id: "all_types_skeleton",
    label: "Referência: um objeto por tipo",
    description:
      "Payload mínimo com um exemplo de cada type suportado (ajuste SKUs, datas e nomes antes de executar).",
    payload: {
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "stock_location",
          client_ref: "loc_principal",
          data: { name: "Armazém Central", type: "main" },
        },
        {
          type: "category",
          client_ref: "cat_acessorios",
          data: { name: "Acessórios", slug: "acessorios" },
        },
        {
          type: "collection",
          client_ref: "col_verao",
          data: { name: "Verão 2026", slug: "verao-2026", status: "draft" },
        },
        {
          type: "party",
          client_ref: "party_forn",
          data: {
            type: "company",
            legalName: "Fornecedor Exemplo Lda",
            documentType: "cnpj",
            documentNumber: "00000000000191",
          },
        },
        {
          type: "customer",
          client_ref: "cli_exemplo",
          data: {
            type: "individual",
            legalName: "Cliente Exemplo",
            documentType: "cpf",
            origin: "manual",
          },
        },
        {
          type: "supplier",
          client_ref: "sup_exemplo",
          data: {
            type: "company",
            legalName: "Fornecedor Ingestão Demo",
            documentType: "cnpj",
          },
        },
        {
          type: "product",
          client_ref: "prod_pai",
          data: {
            sku: "INGEST-SKU-PARENT-001",
            name: "Produto pai (ingestão)",
            productType: "finished_product",
            productKind: "variable",
            salePriceCents: 1000,
            costPriceCents: 400,
            categoryRef: "cat_acessorios",
            collectionRef: "col_verao",
            status: "draft",
          },
        },
        {
          type: "product",
          client_ref: "prod_filho",
          data: {
            sku: "INGEST-SKU-CHILD-001",
            name: "Componente filho",
            productType: "raw_material",
            salePriceCents: 100,
            costPriceCents: 50,
            status: "draft",
          },
        },
        {
          type: "product_variant",
          client_ref: "var_prod_pai_p",
          data: {
            productRef: "prod_pai",
            sku: "INGEST-SKU-PARENT-001-VAR-P",
            name: "Tamanho P",
            attributes: { Tamanho: "P" },
            salePriceCents: 1000,
            costPriceCents: 400,
          },
        },
        {
          type: "product_composition",
          data: {
            parentProductRef: "prod_pai",
            childProductRef: "prod_filho",
            quantity: 1,
            compositionType: "bom",
            required: true,
            isDefault: true,
          },
        },
        {
          type: "inventory_movement",
          data: {
            productRef: "prod_pai",
            variantRef: "var_prod_pai_p",
            locationRef: "loc_principal",
            type: "adjustment",
            quantity: 5,
          },
        },
        {
          type: "order",
          data: {
            channel: "manual",
            customerRef: "cli_exemplo",
            items: [
              {
                sku: "INGEST-SKU-PARENT-001-VAR-P",
                name: "Tamanho P",
                quantity: 1,
                unitPriceCents: 1000,
                productRef: "prod_pai",
                variantRef: "var_prod_pai_p",
              },
            ],
            payments: [],
          },
        },
        {
          type: "purchase_order",
          data: {
            supplierRef: "sup_exemplo",
            issueDate: "2026-01-15",
            items: [
              {
                description: "Matéria-prima",
                quantity: 10,
                unitPriceCents: 100,
                productRef: "prod_filho",
              },
            ],
          },
        },
      ],
    },
  },
  {
    id: "products_only",
    label: "Apenas produtos",
    description: "Dois produtos simples sem imagens.",
    payload: {
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "product",
          client_ref: "a",
          data: {
            sku: "INGEST-A-001",
            name: "Produto A",
            productType: "finished_product",
            salePriceCents: 1990,
            costPriceCents: 800,
            status: "draft",
          },
        },
        {
          type: "product",
          client_ref: "b",
          data: {
            sku: "INGEST-B-001",
            name: "Produto B",
            productType: "service",
            salePriceCents: 5000,
            costPriceCents: 0,
            status: "draft",
          },
        },
      ],
    },
  },
];
