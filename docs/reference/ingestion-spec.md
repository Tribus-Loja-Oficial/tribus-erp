# Ingestão estruturada (Tribus ERP)

Contrato espelhado no **tribus-hub**: envelope `version` / `mode` / `objects`, `client_ref` único, `refMap` no resultado, validação semântica de campos `*Ref`, execução ordenada por dependência.

- **API:** `POST /internal/ingestion/validate` e `POST /internal/ingestion/execute` (Bearer interno, igual a `/internal/orders/ingest`).
- **Web:** apenas **administradores** vêem o botão **Ingestão** no header; **server actions** chamam a API (segredo nunca no browser).

## Convenção JSON

- Campos em **`data` usam camelCase** (alinhados aos schemas REST da erp-api), não snake_case do Hub.
- **Excepção (produto):** na ingestão, URLs de imagem usam **`main_image_url`** e **`gallery_image_urls`** (snake_case); ver [ingestion-field-guide.md](./ingestion-field-guide.md).
- Referências cruzadas no mesmo payload: sufixo **`Ref`** (ex.: `productRef`, `categoryRef`) e valor igual ao **`client_ref`** do alvo.
- Se existir **`…Id`** real (UUID) e **`…Ref`**, a execução resolve **`…Ref` primeiro** via `refMap`, depois cai no `…Id` já presente em `data`.

## Produtos simples vs variáveis (`productKind`)

- Em cada objecto **`product`**, `productKind` pode ser **`simple`** (omissão) ou **`variable`**.
- **`product_variant`** no mesmo payload: o **`productRef`** deve ser o `client_ref` de um `product` com **`productKind`: `"variable"`**. Caso contrário, a validação semântica falha com mensagem a pedir `productKind: "variable"` nesse produto.
- **`inventory_movement`** com **`productRef`** a um produto **variable** definido **no mesmo lote**: é obrigatório **`variantId`** (UUID) **ou** **`variantRef`** (igual ao `client_ref` de um `product_variant` nesse payload). A execução resolve `variantRef` → `variantId` via `refMap` depois de criadas as variantes.
- **`order`** — linhas com **`productRef`** a um produto **variable** no lote: mesma regra (**`variantId`** ou **`variantRef`**). `variantRef` aponta para tipo `product_variant`.
- Referências só cruzam objectos **com `client_ref`** no mapa semântico; produtos sem `client_ref` não entram nas regras “in-batch” acima (use IDs reais ou inclua `client_ref` no pai e nas variantes).

## Envelope

| Campo     | Tipo       | Descrição                       |
| --------- | ---------- | ------------------------------- |
| `version` | `"1.0"`    | Literal fixo.                   |
| `mode`    | `"create"` | Apenas criação em lote.         |
| `objects` | array      | Entre **1** e **200** objectos. |

## Tipos suportados (`type`)

| `type`                | Descrição breve                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `stock_location`      | Local de armazém (`POST /inventory/locations`).                                                                            |
| `category`            | Categoria de produto.                                                                                                      |
| `collection`          | Coleção.                                                                                                                   |
| `party`               | Party base (sem perfil cliente/fornecedor).                                                                                |
| `customer`            | Party + cliente.                                                                                                           |
| `supplier`            | Party + fornecedor.                                                                                                        |
| `product`             | Produto; `productKind`; `categoryRef` / `collectionRef`; URLs de imagem.                                                   |
| `product_variant`     | Variante; `productRef` → `product` variable; `client_ref` recomendado para `variantRef`.                                   |
| `product_composition` | BOM/embalagem; `parentProductRef`; `childProductRef` ou `childSku`.                                                        |
| `inventory_movement`  | Movimento; `productRef`/`productId`, `locationRef`/`locationId`; `variantRef`/`variantId` se pai variable no lote.         |
| `order`               | Pedido; `customerRef`/`customerId`; itens com `productRef` opcional; `variantRef`/`variantId` se produto variable no lote. |
| `purchase_order`      | OC; `supplierRef`/`supplierId`; linhas com `productRef` opcional.                                                          |

## Ordem de execução (`TYPE_ORDER`)

Os objectos são ordenados antes de executar (independentemente da ordem no JSON):

1. `stock_location`
2. `category`
3. `collection`
4. `party`
5. `customer`
6. `supplier`
7. `product`
8. `product_variant`
9. `product_composition`
10. `inventory_movement`
11. `order`
12. `purchase_order`

## Imagens (produto)

`main_image_url` e `gallery_image_urls`: apenas **HTTPS**; JPEG/PNG/WebP; até 5 MB; timeouts e anti-SSRF básico no Worker. Falha de imagem → **aviso** em `items[].warnings`, produto criado (política A).

## Respostas HTTP

### `POST /internal/ingestion/validate`

- `200` + `{ data: { valid, errors, warnings, summary } }`.
- Erros Zod no envelope → `valid: false` e lista de mensagens (como no Hub).

### `POST /internal/ingestion/execute`

- `400` + `VALIDATION_ERROR` + `issues` se o payload for inválido após `safeParse` ou validação semântica.
- `200` / `207` / `422` conforme `created` / `failed`.
- Corpo: `{ data: { total, created, failed, items, refMap } }`.

## Schema JSON e exemplos (contrato para IA)

- **JSON Schema (gerado do Zod):** `apps/erp-web/public/ingestion-payload.schema.json` — exposto no web em `/ingestion-payload.schema.json`. Regeneração: `npm run generate:ingestion-schema` em `apps/erp-api`.
- **Guia de campos / enums / WooCommerce:** [ingestion-field-guide.md](./ingestion-field-guide.md).
- **Exemplos JSON válidos:** `docs/examples/ingestion/*.json` (cada ficheiro é testado contra `ingestionPayloadSchema` na CI).

## Mapeamento rápido (WooCommerce / erros comuns)

| Origem / erro comum                    | Correção no ERP                                   |
| -------------------------------------- | ------------------------------------------------- |
| `productType` = `finished_good`        | `finished_product`                                |
| `status` = `publish`                   | `active`                                          |
| Stock inicial com tipo `initial_stock` | `inventory_movement` com `type`: **`adjustment`** |
| Preço “79.9” em reais                  | `salePriceCents`: **7990** (centavos inteiros)    |

## Ficheiros de referência

- **IA / checklist:** [ingestion-ai-master-template.md](./ingestion-ai-master-template.md)
- **JSON Schema (IDE):** [ingestion-field-guide.md](./ingestion-field-guide.md) + ficheiro gerado em `erp-web/public/`.

## Extensão

Novo domínio: novo literal `type`, ramo no `z.discriminatedUnion`, validação de `*Ref` em `validateIngestionPayload`, handler em `createIngestionObject`, entrada em `INGESTION_TYPE_ORDER` se houver dependência.
