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
          type: "line",
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
            lineRef: "col_verao",
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
        {
          type: "purchase_receipt",
          data: {
            supplierRef: "sup_exemplo",
            issueDate: "2026-01-16",
            locationRef: "loc_principal",
            documentType: "legacy_import",
            items: [
              {
                productRef: "prod_filho",
                purchasedQuantity: 1,
                purchaseUnit: "rolo",
                stockQuantity: 1000,
                stockUnit: "cm",
                grossAmountCents: 3495,
                freightAmountCents: 1000,
              },
            ],
          },
        },
        {
          type: "product_cost_snapshot",
          data: {
            productRef: "prod_pai",
            snapshotDate: "2026-01-16T00:00:00.000Z",
            source: "legacy_ingestion",
            materialCostCents: 550,
            packagingCostCents: 120,
            laborCostCents: 90,
            totalCostCents: 760,
            componentCosts: [
              {
                compositionType: "bom",
                quantity: 1,
                quantityUnit: "unit",
                unitCostBasis: "average",
                unitCost: 550,
                lineTotalCents: 550,
                costSource: "purchase_average",
                childName: "Componente filho",
                childSku: "INGEST-SKU-CHILD-001",
              },
              {
                compositionType: "packaging",
                quantity: 1,
                quantityUnit: "unit",
                packagingChannel: "online",
                unitCostBasis: "legacy_cost_price",
                unitCost: 120,
                lineTotalCents: 120,
                costSource: "legacy_ingestion",
                childName: "Embalagem online (exemplo)",
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
  {
    id: "composition_set_replace_by_parent_sku",
    label: "Substituir composição (SKU do pai)",
    description:
      "Remove linhas no escopo (replaceTypes) e grava novas linhas numa operação atómica. Ajuste parentProductSku e childProductSku para produtos existentes na base.",
    payload: {
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "product_composition_set",
          action: "replace",
          client_ref: "composition-set-example",
          data: {
            parentProductSku: "pf-00001",
            replaceTypes: ["bom", "packaging"],
            items: [
              {
                childProductSku: "CMP-EXEMPLO-001",
                quantity: 1,
                quantityUnit: "m",
                compositionType: "bom",
                required: true,
                isDefault: true,
                notes: "Componente após substituição.",
              },
            ],
          },
        },
      ],
    },
  },
];
