# Domínio: Orders — Tribus ERP

Gerencia pedidos de venda, incluindo ingestão de pedidos externos (CDS) e criação manual.

---

## Modelo de dados

### `orders`

| Campo                | Tipo     | Descrição                                                                             |
| -------------------- | -------- | ------------------------------------------------------------------------------------- |
| `id`                 | text PK  |                                                                                       |
| `orderNumber`        | text     | Número legível gerado automaticamente                                                 |
| `customerId`         | text FK? | Referência a `customers.id`                                                           |
| `status`             | enum     | `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded` |
| `channel`            | text     | Canal de origem (ex.: `ecommerce`, `pos`, `manual`)                                   |
| `source_system`      | text?    | Sistema externo de origem (ex.: `cds`)                                                |
| `source_external_id` | text?    | ID do pedido no sistema externo                                                       |
| `subtotalCents`      | integer  | Soma dos itens sem desconto                                                           |
| `discountCents`      | integer  | Desconto total                                                                        |
| `shippingCents`      | integer  | Frete                                                                                 |
| `taxCents`           | integer  | Impostos                                                                              |
| `totalCents`         | integer  | Total final                                                                           |
| `notes`              | text?    | Observações                                                                           |
| `createdAt`          | text     | ISO 8601                                                                              |
| `updatedAt`          | text     | ISO 8601                                                                              |

### `order_items`

| Campo            | Tipo     | Descrição                                     |
| ---------------- | -------- | --------------------------------------------- |
| `id`             | text PK  |                                               |
| `orderId`        | text FK  |                                               |
| `productId`      | text FK? |                                               |
| `variantId`      | text FK? |                                               |
| `sku`            | text?    | SKU no momento da venda                       |
| `name`           | text     | Nome do produto no momento da venda           |
| `quantity`       | integer  |                                               |
| `unitPriceCents` | integer  | Preço unitário em centavos                    |
| `discountCents`  | integer  | Desconto do item                              |
| `totalCents`     | integer  | `(unitPriceCents * quantity) - discountCents` |

### `order_payments`

| Campo         | Tipo    | Descrição                               |
| ------------- | ------- | --------------------------------------- |
| `id`          | text PK |                                         |
| `orderId`     | text FK |                                         |
| `method`      | text    | Ex.: `credit_card`, `pix`, `cash`       |
| `amountCents` | integer | Valor pago                              |
| `status`      | enum    | `pending`, `paid`, `failed`, `refunded` |
| `externalRef` | text?   | Referência do gateway de pagamento      |
| `paidAt`      | text?   | Data do pagamento                       |

---

## Rotas

| Método  | Path                      | Auth   | Descrição                                |
| ------- | ------------------------- | ------ | ---------------------------------------- |
| `GET`   | `/orders`                 | JWT    | Lista pedidos com paginação e filtros    |
| `POST`  | `/orders`                 | JWT    | Cria pedido manual                       |
| `GET`   | `/orders/:id`             | JWT    | Retorna pedido com itens e pagamentos    |
| `PATCH` | `/orders/:id/status`      | JWT    | Atualiza status do pedido                |
| `POST`  | `/internal/orders/ingest` | Bearer | Ingestão idempotente de pedidos externos |

---

## Ingestão de pedidos externos (CDS)

O CDS envia pedidos via `POST /internal/orders/ingest` com `Authorization: Bearer <ERP_INTERNAL_SECRET>`.

### Idempotência

A ingestão é idempotente por `source_system` + `source_external_id`:

```
Se já existe um pedido com source_system = 'cds' e source_external_id = '12345':
  → retorna o pedido existente (sem criar duplicata)
Caso contrário:
  → cria o pedido novo
```

Isso garante que retentativas de envio do CDS não geram pedidos duplicados.

---

## Regras de negócio

- **Número do pedido** (`orderNumber`) gerado automaticamente na criação.
- **Totais calculados pelo service:** `subtotalCents = Σ(item.totalCents)`, `totalCents = subtotal - discount + shipping + tax`.
- **Atualização de estatísticas do customer:** ao criar pedido, `customers.totalOrders` e `customers.totalSpentCents` são atualizados.
- **Auditoria:** toda mudança de status registra entrada em `audit_logs`.
- **Soft cancel:** pedidos cancelados mantêm histórico; estoque deve ser estornado manualmente via movimento de inventário.

---

## Service

`src/services/order.service.ts` — `createOrderService(db)`

Métodos: `create`, `ingest`, `findById`, `findMany`, `updateStatus`.
