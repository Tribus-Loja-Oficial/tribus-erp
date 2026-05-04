# Referência de rotas — Tribus ERP API

Base URL produção: `https://tribus-erp-api.{account}.workers.dev`

**Autenticação padrão:** todas as rotas (exceto `/health` e `/internal/*`) requerem `Authorization: Bearer <ERP_API_INTERNAL_SECRET>` (chamadas erp-web → erp-api).

**Rotas internas:** `Authorization: Bearer <ERP_INTERNAL_SECRET>` (chamadas CDS → ERP).

---

## Health

| Método | Path      | Auth    | Descrição        |
| ------ | --------- | ------- | ---------------- |
| `GET`  | `/health` | Nenhuma | Status do Worker |

---

## Parties

| Método   | Path                     | Auth | Service                | Descrição                              |
| -------- | ------------------------ | ---- | ---------------------- | -------------------------------------- |
| `GET`    | `/parties`               | JWT  | `party.findMany`       | Lista parties (busca, tipo, paginação) |
| `POST`   | `/parties`               | JWT  | `party.create`         | Cria party                             |
| `GET`    | `/parties/:id`           | JWT  | `party.findById`       | Retorna party com endereços            |
| `PATCH`  | `/parties/:id`           | JWT  | `party.update`         | Atualiza party                         |
| `DELETE` | `/parties/:id`           | JWT  | `party.archive`        | Arquiva party (soft delete)            |
| `POST`   | `/parties/:id/addresses` | JWT  | `party.addAddress`     | Adiciona endereço                      |
| `POST`   | `/parties/:id/customer`  | JWT  | `party.createCustomer` | Cria vínculo de customer               |
| `POST`   | `/parties/:id/supplier`  | JWT  | `party.createSupplier` | Cria vínculo de supplier               |

---

## Customers

| Método | Path             | Auth | Service                         | Descrição                  |
| ------ | ---------------- | ---- | ------------------------------- | -------------------------- |
| `GET`  | `/customers`     | JWT  | `party.listCustomers`           | Lista customers com party  |
| `POST` | `/customers`     | JWT  | `party.createCustomerWithParty` | Cria customer + party      |
| `GET`  | `/customers/:id` | JWT  | `party.findById`                | Retorna customer com party |

---

## Suppliers

| Método | Path             | Auth | Service                         | Descrição                  |
| ------ | ---------------- | ---- | ------------------------------- | -------------------------- |
| `GET`  | `/suppliers`     | JWT  | `party.listSuppliers`           | Lista suppliers com party  |
| `POST` | `/suppliers`     | JWT  | `party.createSupplierWithParty` | Cria supplier + party      |
| `GET`  | `/suppliers/:id` | JWT  | `party.findById`                | Retorna supplier com party |

---

## Products

| Método   | Path                                   | Auth             | Service                           | Descrição                                                                                                                                                                                                                           |
| -------- | -------------------------------------- | ---------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/products`                            | JWT              | `product.listProducts`            | Lista produtos; resposta `{ data, meta: { total, page, limit } }`; query: `q`, `status`, `productType`, `stockFilter`, `channel`, `sortField`, `sortDir`, `page`, `limit`, `composeCatalog`, …                                      |
| `POST`   | `/products`                            | JWT              | `product.create`                  | Cria produto                                                                                                                                                                                                                        |
| `POST`   | `/products/bulk-archive`               | JWT              | `product.archiveProducts`         | Body `{ ids: string[] }` (máx. 100). Arquivamento em massa.                                                                                                                                                                         |
| `POST`   | `/products/bulk-restore`               | JWT              | `product.restoreProducts`         | Body `{ ids: string[] }`. Restaura rascunho + `archivedAt` null.                                                                                                                                                                    |
| `GET`    | `/products/low-stock`                  | JWT              | `product.findLowStock`            | Produtos abaixo do estoque mínimo                                                                                                                                                                                                   |
| `GET`    | `/products/categories`                 | JWT              | `product.findCategories`          | Lista categorias                                                                                                                                                                                                                    |
| `POST`   | `/products/categories`                 | JWT              | `product.createCategory`          | Cria categoria                                                                                                                                                                                                                      |
| `GET`    | `/products/collections`                | JWT              | `product.findCollections`         | Lista coleções                                                                                                                                                                                                                      |
| `POST`   | `/products/media/upload`               | Bearer (interno) | `productMedia.uploadProductImage` | Multipart: `file`; opcional `productId`. Grava R2 + `document_files`.                                                                                                                                                               |
| `GET`    | `/products/document-files/:id/stream`  | Bearer (interno) | `productMedia.streamByFileId`     | Stream da imagem (JPEG/PNG/WebP) para pré-visualização.                                                                                                                                                                             |
| `POST`   | `/api/products/media-upload` (erp-web) | Cookie de sessão | —                                 | Multipart do browser; proxy autenticado para `/products/media/upload`.                                                                                                                                                              |
| `GET`    | `/products/:id`                        | JWT              | `product.findById`                | Retorna produto com variantes                                                                                                                                                                                                       |
| `PATCH`  | `/products/:id`                        | JWT              | `product.update`                  | Atualiza produto                                                                                                                                                                                                                    |
| `POST`   | `/products/:id/restore`                | JWT              | `product.restoreProduct`          | Remove arquivamento (`archivedAt` null, status `draft`).                                                                                                                                                                            |
| `POST`   | `/products/:id/permanent-delete`       | JWT              | `product.permanentDelete`         | Eliminação permanente na BD (cascata acordada), imagens em R2 + `document_files`. Body JSON `{ "confirmSku": "<SKU exato>" }`. Resposta `{ success, deletedFileCount }`. **Não confundir com `DELETE /products/:id` (só arquiva).** |
| `DELETE` | `/products/:id`                        | JWT              | `product.archive`                 | Arquiva produto (soft delete)                                                                                                                                                                                                       |
| `POST`   | `/products/:id/variants`               | JWT              | `product.createVariant`           | Adiciona variante                                                                                                                                                                                                                   |

---

## Inventory

| Método | Path                   | Auth | Service                    | Descrição                                           |
| ------ | ---------------------- | ---- | -------------------------- | --------------------------------------------------- |
| `GET`  | `/inventory/locations` | JWT  | `inventory.findLocations`  | Lista locais de estoque                             |
| `POST` | `/inventory/locations` | JWT  | `inventory.createLocation` | Cria local                                          |
| `GET`  | `/inventory/movements` | JWT  | `inventory.findMovements`  | Lista movimentações (filtros: produto, local, tipo) |
| `POST` | `/inventory/movements` | JWT  | `inventory.addMovement`    | Registra movimentação                               |

**Query params `/inventory/movements`:** `productId`, `locationId`, `type`, `limit`, `offset`.

---

## Orders

| Método  | Path                 | Auth | Service              | Descrição                                |
| ------- | -------------------- | ---- | -------------------- | ---------------------------------------- |
| `GET`   | `/orders`            | JWT  | `order.findMany`     | Lista pedidos (paginação, status, canal) |
| `POST`  | `/orders`            | JWT  | `order.create`       | Cria pedido manual                       |
| `GET`   | `/orders/:id`        | JWT  | `order.findById`     | Retorna pedido com itens e pagamentos    |
| `PATCH` | `/orders/:id/status` | JWT  | `order.updateStatus` | Atualiza status                          |

---

## POS

| Método | Path                      | Auth | Service                   | Descrição                              |
| ------ | ------------------------- | ---- | ------------------------- | -------------------------------------- |
| `GET`  | `/pos/registers`          | JWT  | `pos.findActiveRegisters` | Lista registradoras ativas             |
| `POST` | `/pos/registers`          | JWT  | `pos.createRegister`      | Cria registradora                      |
| `GET`  | `/pos/sessions`           | JWT  | `pos.findSessions`        | Lista sessões de caixa                 |
| `POST` | `/pos/sessions`           | JWT  | `pos.openSession`         | Abre sessão de caixa                   |
| `GET`  | `/pos/sessions/:id`       | JWT  | `pos.findSessionById`     | Retorna sessão com detalhes            |
| `POST` | `/pos/sessions/:id/close` | JWT  | `pos.closeSession`        | Fecha sessão                           |
| `POST` | `/pos/sales`              | JWT  | `pos.createSale`          | Registra venda no caixa                |
| `POST` | `/pos/movements`          | JWT  | `pos.addMovement`         | Registra entrada/saída manual de caixa |

---

## Finance

| Método | Path                               | Auth | Service                       | Descrição                     |
| ------ | ---------------------------------- | ---- | ----------------------------- | ----------------------------- |
| `GET`  | `/finance/dashboard`               | JWT  | `finance.getDashboardSummary` | Resumo financeiro por período |
| `GET`  | `/finance/accounts`                | JWT  | `finance.findAccounts`        | Lista contas financeiras      |
| `POST` | `/finance/accounts`                | JWT  | `finance.createAccount`       | Cria conta                    |
| `GET`  | `/finance/chart-of-accounts`       | JWT  | `finance.findChartOfAccounts` | Lista plano de contas         |
| `GET`  | `/finance/cost-centers`            | JWT  | `finance.findCostCenters`     | Lista centros de custo        |
| `GET`  | `/finance/entries`                 | JWT  | `finance.findEntries`         | Lista lançamentos             |
| `POST` | `/finance/entries`                 | JWT  | `finance.createEntry`         | Cria lançamento               |
| `GET`  | `/finance/payables`                | JWT  | `finance.findPayables`        | Lista contas a pagar          |
| `POST` | `/finance/payables`                | JWT  | `finance.createPayable`       | Cria conta a pagar            |
| `POST` | `/finance/payables/:id/pay`        | JWT  | `finance.payPayable`          | Registra pagamento            |
| `GET`  | `/finance/receivables`             | JWT  | `finance.findReceivables`     | Lista contas a receber        |
| `POST` | `/finance/receivables`             | JWT  | `finance.createReceivable`    | Cria conta a receber          |
| `POST` | `/finance/receivables/:id/receive` | JWT  | `finance.receiveReceivable`   | Registra recebimento          |

---

## Fiscal

| Método | Path                 | Auth | Service            | Descrição                   |
| ------ | -------------------- | ---- | ------------------ | --------------------------- |
| `GET`  | `/fiscal`            | JWT  | `fiscal.findMany`  | Lista documentos fiscais    |
| `POST` | `/fiscal/xml/import` | JWT  | `fiscal.importXml` | Importa NF-e via XML        |
| `GET`  | `/fiscal/:id`        | JWT  | `fiscal.findById`  | Retorna documento com itens |

---

## Purchases

| Método  | Path                     | Auth | Service                 | Descrição                          |
| ------- | ------------------------ | ---- | ----------------------- | ---------------------------------- |
| `GET`   | `/purchases`             | JWT  | `purchase.findMany`     | Lista ordens de compra             |
| `POST`  | `/purchases`             | JWT  | `purchase.create`       | Cria ordem de compra               |
| `GET`   | `/purchases/:id`         | JWT  | `purchase.findById`     | Retorna ordem com itens            |
| `PATCH` | `/purchases/:id/status`  | JWT  | `purchase.updateStatus` | Atualiza status                    |
| `POST`  | `/purchases/:id/receive` | JWT  | `purchase.receive`      | Registra recebimento de mercadoria |

---

## Production

| Método | Path                                 | Auth | Service                              | Descrição                  |
| ------ | ------------------------------------ | ---- | ------------------------------------ | -------------------------- |
| `GET`  | `/production/orders`                 | JWT  | `production.findMany`                | Lista ordens de produção   |
| `POST` | `/production/orders`                 | JWT  | `production.createProductionOrder`   | Cria ordem                 |
| `GET`  | `/production/orders/:id`             | JWT  | `production.findById`                | Retorna ordem com detalhes |
| `POST` | `/production/orders/:id/start`       | JWT  | `production.startProductionOrder`    | Inicia produção            |
| `POST` | `/production/orders/:id/complete`    | JWT  | `production.completeProductionOrder` | Conclui produção           |
| `POST` | `/production/orders/:id/cancel`      | JWT  | `production.cancelProductionOrder`   | Cancela ordem              |
| `GET`  | `/production/bom/product/:productId` | JWT  | `production.findBomsByProduct`       | Lista BOMs do produto      |
| `POST` | `/production/bom`                    | JWT  | `production.createBom`               | Cria ficha técnica (BOM)   |

---

## Reports

| Método | Path                            | Auth | Descrição                                    |
| ------ | ------------------------------- | ---- | -------------------------------------------- |
| `GET`  | `/reports/dre`                  | JWT  | DRE — Demonstração do Resultado do Exercício |
| `GET`  | `/reports/cashflow`             | JWT  | Fluxo de caixa por período                   |
| `GET`  | `/reports/margin`               | JWT  | Margem de lucro por produto                  |
| `GET`  | `/reports/sales-by-channel`     | JWT  | Vendas agrupadas por canal                   |
| `GET`  | `/reports/inventory-valuation`  | JWT  | Valorização do estoque                       |
| `GET`  | `/reports/payables-receivables` | JWT  | Resumo de contas a pagar e receber           |

---

## Internal (Bearer `ERP_INTERNAL_SECRET`)

| Método | Path                          | Auth   | Service            | Descrição                                      |
| ------ | ----------------------------- | ------ | ------------------ | ---------------------------------------------- |
| `POST` | `/internal/orders/ingest`     | Bearer | `order.ingest`     | Ingestão idempotente de pedidos externos (CDS) |
| `POST` | `/internal/fiscal/xml/import` | Bearer | `fiscal.importXml` | Importação interna de XML fiscal               |

---

## Erros padrão

| Código | Descrição                                             |
| ------ | ----------------------------------------------------- |
| `400`  | Body ou query inválidos (Zod validation error)        |
| `401`  | Token ausente ou inválido                             |
| `404`  | Recurso não encontrado                                |
| `409`  | Conflito (ex.: SKU duplicado, accessKey já importada) |
| `500`  | Erro interno do servidor                              |
