# Domínio: Products — Tribus ERP

Gerencia o catálogo de produtos, variantes, categorias e coleções.

---

## Modelo de dados

### `products`

| Campo          | Tipo     | Descrição                                    |
| -------------- | -------- | -------------------------------------------- |
| `id`           | text PK  |                                              |
| `name`         | text     | Nome do produto                              |
| `slug`         | text     | URL-friendly, gerado automaticamente do nome |
| `sku`          | text?    | Código único do produto                      |
| `description`  | text?    |                                              |
| `categoryId`   | text FK? | Referência a `product_categories.id`         |
| `costCents`    | integer? | Custo unitário em centavos                   |
| `priceCents`   | integer? | Preço de venda em centavos                   |
| `currentStock` | integer  | Estoque atual (atualizado via movimentos)    |
| `minStock`     | integer? | Estoque mínimo para alertas                  |
| `unit`         | text     | Unidade de medida (ex.: `un`, `kg`, `m`)     |
| `isActive`     | boolean  | Produto ativo para venda                     |
| `createdAt`    | text     | ISO 8601                                     |
| `updatedAt`    | text     | ISO 8601                                     |
| `archivedAt`   | text?    | Soft delete                                  |

### `product_variants`

| Campo          | Tipo     | Descrição                                               |
| -------------- | -------- | ------------------------------------------------------- |
| `id`           | text PK  |                                                         |
| `productId`    | text FK  |                                                         |
| `name`         | text     | Nome da variante (ex.: "Azul M")                        |
| `sku`          | text?    | SKU da variante                                         |
| `attributes`   | text     | JSON com atributos (ex.: `{"color":"blue","size":"M"}`) |
| `priceCents`   | integer? | Preço específico (sobrepõe produto)                     |
| `currentStock` | integer  | Estoque da variante                                     |
| `isActive`     | boolean  |                                                         |

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

| Método   | Path                     | Descrição                           |
| -------- | ------------------------ | ----------------------------------- |
| `GET`    | `/products`              | Lista produtos (paginação, filtros) |
| `POST`   | `/products`              | Cria produto                        |
| `GET`    | `/products/low-stock`    | Produtos abaixo do estoque mínimo   |
| `GET`    | `/products/categories`   | Lista categorias                    |
| `POST`   | `/products/categories`   | Cria categoria                      |
| `GET`    | `/products/collections`  | Lista coleções                      |
| `GET`    | `/products/:id`          | Retorna produto com variantes       |
| `PATCH`  | `/products/:id`          | Atualiza produto                    |
| `DELETE` | `/products/:id`          | Arquiva produto (soft delete)       |
| `POST`   | `/products/:id/variants` | Adiciona variante                   |

---

## Regras de negócio

- **`slug` gerado automaticamente** do nome na criação. Deve ser único.
- **`sku` único**: se fornecido, não pode colidir com outro produto ou variante.
- **`currentStock` nunca alterado diretamente** — sempre via `stock_movements`. O inventory service atualiza o campo após registrar o movimento.
- **Soft delete via `archivedAt`**: produtos arquivados não aparecem em listas mas mantêm histórico de movimentos e itens de pedido.
- **Alerta de low stock**: `GET /products/low-stock` retorna produtos onde `currentStock <= minStock`.

---

## Service

`src/services/product.service.ts` — `createProductService(db)`

Métodos: `create`, `findById`, `findMany`, `findLowStock`, `update`, `archive`, `createCategory`, `createCollection`, `findCategories`, `findCollections`, `createVariant`.
