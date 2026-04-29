# Domínio: Purchases — Tribus ERP

Gerencia ordens de compra para fornecedores e o recebimento de mercadorias.

---

## Modelo de dados

### `purchase_orders`

| Campo        | Tipo    | Descrição                                             |
| ------------ | ------- | ----------------------------------------------------- |
| `id`         | text PK |                                                       |
| `supplierId` | text FK | Referência a `suppliers.id`                           |
| `status`     | enum    | `draft`, `sent`, `confirmed`, `received`, `cancelled` |
| `totalCents` | integer | Valor total em centavos                               |
| `expectedAt` | text?   | Data prevista de entrega                              |
| `receivedAt` | text?   | Data de recebimento efetivo                           |
| `notes`      | text?   |                                                       |
| `createdAt`  | text    | ISO 8601                                              |
| `updatedAt`  | text    | ISO 8601                                              |

### `purchase_order_items`

| Campo              | Tipo     | Descrição                        |
| ------------------ | -------- | -------------------------------- |
| `id`               | text PK  |                                  |
| `purchaseOrderId`  | text FK  |                                  |
| `productId`        | text FK  |                                  |
| `variantId`        | text FK? |                                  |
| `quantity`         | integer  | Quantidade solicitada            |
| `receivedQuantity` | integer  | Quantidade efetivamente recebida |
| `unitCostCents`    | integer  | Custo unitário negociado         |
| `totalCents`       | integer  | `quantity * unitCostCents`       |

---

## Rotas

| Método  | Path                     | Descrição                                   |
| ------- | ------------------------ | ------------------------------------------- |
| `GET`   | `/purchases`             | Lista ordens de compra (paginação, filtros) |
| `POST`  | `/purchases`             | Cria ordem de compra                        |
| `GET`   | `/purchases/:id`         | Retorna ordem com itens                     |
| `PATCH` | `/purchases/:id/status`  | Atualiza status                             |
| `POST`  | `/purchases/:id/receive` | Registra recebimento de mercadoria          |

---

## Fluxo de recebimento

```
POST /purchases/:id/receive
  → PurchaseService.receive()
    → Para cada item recebido:
      InventoryService.addMovement({
        type: 'purchase',
        productId: item.productId,
        quantity: +receivedQuantity,
        costCents: item.unitCostCents,
        reference: purchaseOrderId
      })
    → Atualiza purchase_order_items.receivedQuantity
    → Se todos itens recebidos: status → 'received', define receivedAt
```

---

## Regras de negócio

- **Recebimento parcial**: é possível receber quantidade menor que a solicitada; `receivedQuantity` é atualizado por item.
- **Geração automática de movimentos de estoque** no recebimento (tipo `purchase`).
- **`unitCostCents`** do item de compra é usado como custo no `stock_movement` — permite rastrear custo médio.
- **Cancelamento**: apenas ordens com status `draft` ou `sent` podem ser canceladas.

---

## Service

`src/services/purchase.service.ts` — `createPurchaseService(db)`

Métodos: `create`, `findById`, `findMany`, `updateStatus`, `receive`.
