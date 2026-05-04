# Template de ingestão para IA — Tribus ERP

Use este documento como checklist ao gerar payloads para `POST /internal/ingestion/validate` e `POST /internal/ingestion/execute`.

## Regras fixas

1. **Envelope:** `{ "version": "1.0", "mode": "create", "objects": [ ... ] }`.
2. **Limite:** 1–200 objectos por pedido.
3. **Naming em `data`:** **camelCase** (igual à API REST do ERP).
4. **`client_ref`:** string única no payload por objecto que a usa; aparece em `refMap` após sucesso com o ID criado.
5. **Ligações:** use `*Ref` apontando para o `client_ref` do objecto alvo **do tipo correcto** (ex.: `productRef` → objecto `type: "product"`).
6. **Ordem:** o servidor ordena por dependência; ainda assim declare referenciados **antes** no JSON quando possível, para legibilidade.

## Tipos e dependências (resumo)

| type                  | Depende de (via Ref)                         |
| --------------------- | -------------------------------------------- |
| `category`            | Opcional: `parentCategoryRef` → `category`   |
| `product`             | Opcional: `categoryRef`, `collectionRef`     |
| `product_variant`     | `productRef` → `product`                     |
| `product_composition` | `parentProductRef`; `childProductRef` ou SKU |
| `inventory_movement`  | `productRef` e/ou `locationRef`              |
| `order`               | `customerRef`; itens `productRef` opcional   |
| `purchase_order`      | `supplierRef`; linhas `productRef` opcional  |

## Campos frequentes

### `product`

Obrigatórios típicos: `sku`, `name`, `productType`, `salePriceCents`, `costPriceCents` (ou defaults do schema).  
Opcionais úteis: `status`, `categoryRef`, `collectionRef`, `main_image_url`, `gallery_image_urls`.

### `order`

- `customerId` **ou** `customerRef`.
- `items[]`: cada linha precisa de `sku`, `name`, `quantity`, `unitPriceCents`; `productRef` ou `productId` opcional.

### `purchase_order`

- `supplierId` **ou** `supplierRef`.
- `issueDate` (`YYYY-MM-DD`), `items[]` com `description`, `quantity`, `unitPriceCents`.

## Erros comuns

- `client_ref` duplicado.
- `productRef` apontando para `client_ref` de um **supplier** em vez de **product**.
- `childSku` sem produto correspondente na base nem criado antes no mesmo payload (use `childProductRef` quando o filho é criado no lote).
- Movimento de saída sem stock suficiente (falha só nesse objecto).

## Referência máquina

Ver `public/ingestion-payload.schema.json` no **erp-web** e o código-fonte `apps/erp-api/src/schemas/ingestion.schemas.ts`.
