# Domínio: Products — Tribus ERP

Gerencia o catálogo de produtos, variantes, categorias e coleções.

---

## Modelo de dados

### `products`

| Campo          | Tipo     | Descrição                                                                                                            |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`           | text PK  |                                                                                                                      |
| `externalRef`  | text     | Referência humana estável única (ex.: `PRD-0001`); gerada na criação; imutável                                       |
| `productKind`  | text     | `simple` (cadastro único) ou `variable` (pai com variações); preço base do pai pode servir de fallback nas variações |
| `name`         | text     | Nome do produto                                                                                                      |
| `slug`         | text     | URL-friendly, gerado automaticamente do nome                                                                         |
| `sku`          | text?    | Código único do produto                                                                                              |
| `description`  | text?    |                                                                                                                      |
| `categoryId`   | text FK? | Referência a `product_categories.id`                                                                                 |
| `costCents`    | integer? | Custo unitário em centavos                                                                                           |
| `priceCents`   | integer? | Preço de venda em centavos                                                                                           |
| `currentStock` | integer  | Estoque atual (atualizado via movimentos)                                                                            |
| `minStock`     | integer? | Estoque mínimo para alertas                                                                                          |
| `unit`         | text     | Unidade de medida (ex.: `un`, `kg`, `m`)                                                                             |
| `isActive`     | boolean  | Produto ativo para venda                                                                                             |
| `createdAt`    | text     | ISO 8601                                                                                                             |
| `updatedAt`    | text     | ISO 8601                                                                                                             |
| `archivedAt`   | text?    | Soft delete                                                                                                          |

### `product_variants`

Linha vendável/estocável ligada a um `products.id` quando `productKind = variable`.

| Campo                 | Tipo    | Descrição                                       |
| --------------------- | ------- | ----------------------------------------------- |
| `id`                  | text PK |                                                 |
| `productId`           | text FK | Produto pai                                     |
| `externalRef`         | text    | Ref. estável `PRV-NNNN` (gerada na criação)     |
| `sku`                 | text    | Único global (produto ou variação)              |
| `name`                | text?   | Opcional                                        |
| `attributesJson`      | text    | Mapa chave/valor (MVP)                          |
| `salePriceCents` etc. | int?    | Preços/custos opcionais; `null` herda do pai    |
| `currentStock`        | integer | Estoque da variação; movimentos com `variantId` |
| `status`              | text    | `draft` / `active` / `inactive` / `archived`    |
| `archivedAt`          | text?   | Arquivamento da variação                        |

### `product_categories`

| Campo         | Tipo     | Descrição                            |
| ------------- | -------- | ------------------------------------ |
| `id`          | text PK  |                                      |
| `name`        | text     |                                      |
| `slug`        | text     |                                      |
| `parentId`    | text FK? | Categoria pai (suporte a hierarquia) |
| `description` | text?    |                                      |

### `product_collections`

| Campo         | Tipo    | Descrição |
| ------------- | ------- | --------- |
| `id`          | text PK |           |
| `name`        | text    |           |
| `slug`        | text    |           |
| `description` | text?   |           |
| `isActive`    | boolean |           |

---

## Rotas

| Método   | Path                                        | Descrição                                                                                                                                     |
| -------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/products`                                 | Lista produtos (paginação, filtros; `productKind`; agregados `variantCount`, `minEffectiveSaleCents`, `maxEffectiveSaleCents` para variáveis) |
| `POST`   | `/products`                                 | Cria produto                                                                                                                                  |
| `GET`    | `/products/low-stock`                       | Produtos abaixo do estoque mínimo                                                                                                             |
| `GET`    | `/products/categories`                      | Lista categorias                                                                                                                              |
| `POST`   | `/products/categories`                      | Cria categoria                                                                                                                                |
| `GET`    | `/products/collections`                     | Lista coleções                                                                                                                                |
| `GET`    | `/products/:id`                             | Retorna produto com variantes (`externalRef` incluído)                                                                                        |
| `GET`    | `/products/:id/detail`                      | Vista operacional (produto + composições, custo, **variants**)                                                                                |
| `GET`    | `/products/:id/variants`                    | Lista variações (vazio se produto simples)                                                                                                    |
| `PATCH`  | `/products/:id/variants/:variantId`         | Atualiza variação                                                                                                                             |
| `POST`   | `/products/:id/variants/:variantId/archive` | Arquiva variação                                                                                                                              |
| `POST`   | `/products/:id/variants/:variantId/restore` | Restaura variação                                                                                                                             |
| `PATCH`  | `/products/:id`                             | Atualiza produto                                                                                                                              |
| `DELETE` | `/products/:id`                             | Arquiva produto (soft delete)                                                                                                                 |
| `POST`   | `/products/:id/permanent-delete`            | Eliminação permanente (BD + R2); body `{ confirmSku }`                                                                                        |
| `POST`   | `/products/:id/variants`                    | Adiciona variante                                                                                                                             |

---

## Regras de negócio

- **`externalRef` (produto)**: `PRD-NNNN`; imutável via `PATCH`.
- **`externalRef` (variação)**: `PRV-NNNN`; imutável; gerada na criação da variação.
- **`productKind`**: `variable` → estoque do pai é a soma das variações ativas (sincronizado em `products.current_stock`); movimentos de inventário exigem `variantId`. `simple` → estoque no produto.
- **`product_compositions.parentVariantId`**: reservado para composição por variação (MVP: composição apenas ao nível do produto, `parentVariantId` nulo).
- **`slug` gerado automaticamente** do nome na criação. Deve ser único.
- **`sku` único**: se fornecido, não pode colidir com outro produto ou variante.
- **`currentStock` nunca alterado diretamente** — sempre via `stock_movements`. O inventory service atualiza o campo após registrar o movimento.
- **Soft delete via `archivedAt`**: produtos arquivados não aparecem em listas mas mantêm histórico de movimentos e itens de pedido.
- **`POST /products/:id/permanent-delete`**: remove o produto, dados operacionais ligados (movimentos, variantes, composições, OPs de produção deste produto, etc.), limpa imagens em R2 e linhas em `document_files`. Em pedidos, faturas e linhas de compra preserva totais anulando `product_id` onde o modelo permite. Exige `confirmSku` igual ao SKU do produto.
- **Alerta de low stock**: `GET /products/low-stock` retorna produtos onde `currentStock <= minStock`.

---

## Service

`src/services/product.service.ts` — `createProductService(db)`

Métodos: `create`, `findById`, `listProducts`, `findLowStock`, `update`, `archive`, `restoreProduct`, `permanentDelete`, `createCategory`, `createCollection`, `findCategories`, `findCollections`, `createVariant`, `listVariants`, `updateVariant`, `archiveVariant`, `restoreVariant`. Serviço dedicado: `src/services/product-variant.service.ts`.
