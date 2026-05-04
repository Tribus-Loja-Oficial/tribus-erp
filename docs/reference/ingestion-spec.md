# Ingestão estruturada (Tribus ERP)

Contrato espelhado no **tribus-hub**: envelope `version` / `mode` / `objects`, `client_ref` único, `refMap` no resultado, validação semântica de campos `*Ref`, execução ordenada por dependência.

- **API:** `POST /internal/ingestion/validate` e `POST /internal/ingestion/execute` (Bearer interno, igual a `/internal/orders/ingest`).
- **Web:** apenas **administradores** vêem o botão **Ingestão** no header; **server actions** chamam a API (segredo nunca no browser).

## Convenção JSON

- Campos em **`data` usam camelCase** (alinhados aos schemas REST da erp-api), não snake_case do Hub.
- Referências cruzadas no mesmo payload: sufixo **`Ref`** (ex.: `productRef`, `categoryRef`) e valor igual ao **`client_ref`** do alvo.
- Se existir **`…Id`** real (UUID) e **`…Ref`**, a execução resolve **`…Ref` primeiro** via `refMap`, depois cai no `…Id` já presente em `data`.

## Envelope

| Campo     | Tipo       | Descrição                       |
| --------- | ---------- | ------------------------------- |
| `version` | `"1.0"`    | Literal fixo.                   |
| `mode`    | `"create"` | Apenas criação em lote.         |
| `objects` | array      | Entre **1** e **200** objectos. |

## Tipos suportados (`type`)

| `type`                | Descrição breve                                                      |
| --------------------- | -------------------------------------------------------------------- |
| `stock_location`      | Local de armazém (`POST /inventory/locations`).                      |
| `category`            | Categoria de produto.                                                |
| `collection`          | Coleção.                                                             |
| `party`               | Party base (sem perfil cliente/fornecedor).                          |
| `customer`            | Party + cliente.                                                     |
| `supplier`            | Party + fornecedor.                                                  |
| `product`             | Produto; `categoryRef` / `collectionRef`; URLs de imagem.            |
| `product_variant`     | Variante; `productRef` → `product`.                                  |
| `product_composition` | BOM/embalagem; `parentProductRef`; `childProductRef` ou `childSku`.  |
| `inventory_movement`  | Movimento; `productRef`/`productId`, `locationRef`/`locationId`.     |
| `order`               | Pedido; `customerRef`/`customerId`; itens com `productRef` opcional. |
| `purchase_order`      | OC; `supplierRef`/`supplierId`; linhas com `productRef` opcional.    |

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

## Ficheiros de referência

- **IA / checklist:** [ingestion-ai-master-template.md](./ingestion-ai-master-template.md)
- **JSON Schema (IDE):** `erp-web/public/ingestion-payload.schema.json` (URL `/ingestion-payload.schema.json` no web).

## Extensão

Novo domínio: novo literal `type`, ramo no `z.discriminatedUnion`, validação de `*Ref` em `validateIngestionPayload`, handler em `createIngestionObject`, entrada em `INGESTION_TYPE_ORDER` se houver dependência.
