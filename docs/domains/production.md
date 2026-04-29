# Domínio: Production — Tribus ERP

Gerencia a produção interna: fichas técnicas (BOM), ordens de produção, consumo de componentes e registro de perdas.

---

## Modelo de dados

### `bill_of_materials` (BOM)

| Campo            | Tipo    | Descrição                         |
| ---------------- | ------- | --------------------------------- |
| `id`             | text PK |                                   |
| `productId`      | text FK | Produto final produzido           |
| `name`           | text    | Nome da ficha técnica             |
| `outputQuantity` | integer | Quantidade produzida por execução |
| `isActive`       | boolean |                                   |
| `createdAt`      | text    | ISO 8601                          |

### `bom_items`

| Campo                | Tipo     | Descrição                                 |
| -------------------- | -------- | ----------------------------------------- |
| `id`                 | text PK  |                                           |
| `bomId`              | text FK  |                                           |
| `componentProductId` | text FK  | Produto componente                        |
| `componentVariantId` | text FK? | Variante do componente                    |
| `quantity`           | real     | Quantidade necessária por execução de BOM |
| `unit`               | text     | Unidade do componente                     |
| `notes`              | text?    |                                           |

### `production_orders`

| Campo         | Tipo    | Descrição                                          |
| ------------- | ------- | -------------------------------------------------- |
| `id`          | text PK |                                                    |
| `bomId`       | text FK | BOM utilizada                                      |
| `productId`   | text FK | Produto a ser produzido                            |
| `quantity`    | integer | Quantidade planejada                               |
| `status`      | enum    | `planned`, `in_progress`, `completed`, `cancelled` |
| `startedAt`   | text?   | Início da produção                                 |
| `completedAt` | text?   | Fim da produção                                    |
| `notes`       | text?   |                                                    |
| `createdAt`   | text    | ISO 8601                                           |

### `production_order_consumptions`

| Campo               | Tipo     | Descrição                            |
| ------------------- | -------- | ------------------------------------ |
| `id`                | text PK  |                                      |
| `productionOrderId` | text FK  |                                      |
| `productId`         | text FK  | Componente consumido                 |
| `variantId`         | text FK? |                                      |
| `quantityConsumed`  | real     |                                      |
| `costCents`         | integer? | Custo unitário no momento do consumo |

### `production_order_losses`

| Campo               | Tipo    | Descrição                  |
| ------------------- | ------- | -------------------------- |
| `id`                | text PK |                            |
| `productionOrderId` | text FK |                            |
| `productId`         | text FK | Produto/componente perdido |
| `quantityLost`      | real    |                            |
| `reason`            | text?   | Motivo da perda            |

---

## Rotas

| Método | Path                                 | Descrição                  |
| ------ | ------------------------------------ | -------------------------- |
| `GET`  | `/production/orders`                 | Lista ordens de produção   |
| `POST` | `/production/orders`                 | Cria ordem de produção     |
| `GET`  | `/production/orders/:id`             | Retorna ordem com detalhes |
| `POST` | `/production/orders/:id/start`       | Inicia produção            |
| `POST` | `/production/orders/:id/complete`    | Conclui produção           |
| `POST` | `/production/orders/:id/cancel`      | Cancela ordem              |
| `GET`  | `/production/bom/product/:productId` | Lista BOMs do produto      |
| `POST` | `/production/bom`                    | Cria ficha técnica (BOM)   |

---

## Fluxo de produção

```
1. POST /production/orders (cria ordem com BOM e quantidade)

2. POST /production/orders/:id/start
   → status: planned → in_progress
   → define startedAt

3. POST /production/orders/:id/complete
   → Para cada bom_item:
     InventoryService.addMovement({ type: 'production_out', quantity: -consumido })
     Registra em production_order_consumptions
   → InventoryService.addMovement({ type: 'production_in', quantity: +produzido })
   → Se houver perdas: InventoryService.addMovement({ type: 'damaged', ... })
     Registra em production_order_losses
   → status: in_progress → completed
   → define completedAt
```

---

## Regras de negócio

- **BOM obrigatória**: toda ordem de produção referencia uma BOM ativa.
- **Consumo automático** de componentes ao completar a ordem.
- **Produção alimenta o estoque** via movimento `production_in` no produto final.
- **Perdas registradas separadamente**: a perda é registrada como `damaged` no inventário e documentada em `production_order_losses`.
- **Cancelamento**: apenas ordens `planned` podem ser canceladas sem impacto em estoque.

---

## Service

`src/services/production.service.ts` — `createProductionService(db)`

Métodos: `createBom`, `findBomsByProduct`, `createProductionOrder`, `findMany`, `startProductionOrder`, `completeProductionOrder`, `cancelProductionOrder`.
