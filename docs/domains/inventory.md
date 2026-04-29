# Domínio: Inventory — Tribus ERP

Controla o estoque da operação por meio de locais de armazenamento e movimentações tipificadas. O estoque nunca é alterado diretamente: toda variação passa por um registro em `stock_movements`.

---

## Modelo de dados

### `stock_locations`

| Campo         | Tipo    | Descrição                                |
| ------------- | ------- | ---------------------------------------- |
| `id`          | text PK |                                          |
| `name`        | text    | Ex.: "Depósito Principal", "Loja Física" |
| `description` | text?   |                                          |
| `isActive`    | boolean |                                          |
| `createdAt`   | text    | ISO 8601                                 |

### `stock_movements`

| Campo        | Tipo     | Descrição                                              |
| ------------ | -------- | ------------------------------------------------------ |
| `id`         | text PK  |                                                        |
| `productId`  | text FK  |                                                        |
| `variantId`  | text FK? |                                                        |
| `locationId` | text FK  |                                                        |
| `type`       | enum     | Ver tipos abaixo                                       |
| `quantity`   | integer  | Positivo = entrada; negativo = saída                   |
| `costCents`  | integer? | Custo unitário do movimento em centavos                |
| `reference`  | text?    | ID externo relacionado (ex.: orderId, purchaseOrderId) |
| `notes`      | text?    |                                                        |
| `createdAt`  | text     | ISO 8601                                               |
| `createdBy`  | text?    | ID do usuário que registrou                            |

---

## Tipos de movimento (11 tipos)

| Tipo                  | Direção     | Descrição                              |
| --------------------- | ----------- | -------------------------------------- |
| `purchase`            | Entrada (+) | Recebimento de compra                  |
| `sale`                | Saída (-)   | Venda                                  |
| `return`              | Entrada (+) | Devolução de cliente                   |
| `adjustment`          | ±any        | Ajuste manual de estoque               |
| `production_in`       | Entrada (+) | Produto finalizado da produção         |
| `production_out`      | Saída (-)   | Consumo de componente na produção      |
| `transfer_in`         | Entrada (+) | Transferência recebida de outro local  |
| `transfer_out`        | Saída (-)   | Transferência enviada para outro local |
| `damaged`             | Saída (-)   | Produto avariado/perdido               |
| `reservation`         | Saída (-)   | Reserva para pedido                    |
| `release_reservation` | Entrada (+) | Liberação de reserva                   |

---

## Rotas

| Método | Path                   | Descrição                                           |
| ------ | ---------------------- | --------------------------------------------------- |
| `GET`  | `/inventory/locations` | Lista locais de estoque                             |
| `POST` | `/inventory/locations` | Cria local                                          |
| `GET`  | `/inventory/movements` | Lista movimentações (filtros: produto, local, tipo) |
| `POST` | `/inventory/movements` | Registra movimentação                               |

---

## Regras de negócio

- **`products.currentStock` e `product_variants.currentStock`** são atualizados automaticamente pelo inventory service após cada movimento.
- **Estoque negativo**: não permitido por padrão (exceto tipo `adjustment` com flag explícita).
- **Rastreabilidade**: cada movimento tem `reference` apontando para o documento de origem (pedido, ordem de compra, ordem de produção).
- **Custo médio**: o campo `costCents` no movimento registra o custo unitário naquele momento, permitindo cálculo de custo médio ponderado.

---

## Fluxo de venda

```
POST /orders (cria pedido)
  → OrderService.create()
    → InventoryService.addMovement({ type: 'sale', quantity: -N })
      → atualiza products.currentStock
      → registra em stock_movements
```

---

## Fluxo de compra

```
POST /purchases/:id/receive
  → PurchaseService.receive()
    → InventoryService.addMovement({ type: 'purchase', quantity: +N })
      → atualiza products.currentStock
      → registra em stock_movements
```

---

## Service

`src/services/inventory.service.ts` — `createInventoryService(db)`

Métodos: `addMovement`, `adjustStock`, `findLocations`, `createLocation`, `findMovements`.
