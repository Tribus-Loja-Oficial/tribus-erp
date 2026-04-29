# Domínio: Parties — Tribus ERP

Parties é a entidade base para representar pessoas físicas e jurídicas no sistema. Customers e Suppliers são especializações de Party.

---

## Modelo de dados

### `parties`

| Campo            | Tipo    | Descrição                                  |
| ---------------- | ------- | ------------------------------------------ |
| `id`             | text PK | ID gerado por `generateId()`               |
| `type`           | enum    | `individual` ou `company`                  |
| `legalName`      | text    | Nome completo / Razão social               |
| `tradeName`      | text?   | Nome fantasia                              |
| `documentType`   | enum    | `cpf`, `cnpj`, `foreign`, `unknown`        |
| `documentNumber` | text?   | CPF ou CNPJ                                |
| `email`          | text?   | E-mail principal                           |
| `phone`          | text?   | Telefone                                   |
| `notes`          | text?   | Observações internas                       |
| `cdsConsumerId`  | text?   | ID do consumidor no CDS (quando vinculado) |
| `createdAt`      | text    | ISO 8601                                   |
| `updatedAt`      | text    | ISO 8601                                   |
| `archivedAt`     | text?   | Soft delete                                |

### `party_addresses`

| Campo          | Tipo    | Descrição                  |
| -------------- | ------- | -------------------------- |
| `id`           | text PK |                            |
| `partyId`      | text FK | Referência a `parties.id`  |
| `label`        | text?   | Ex.: "Cobrança", "Entrega" |
| `street`       | text    |                            |
| `number`       | text    |                            |
| `complement`   | text?   |                            |
| `neighborhood` | text    |                            |
| `city`         | text    |                            |
| `state`        | text    | UF                         |
| `postalCode`   | text    | CEP                        |
| `country`      | text    | Padrão: `BR`               |
| `isDefault`    | boolean | Endereço principal         |

### `customers`

| Campo             | Tipo    | Descrição                                  |
| ----------------- | ------- | ------------------------------------------ |
| `id`              | text PK |                                            |
| `partyId`         | text FK | Referência a `parties.id`                  |
| `cdsConsumerId`   | text?   | ID no CDS                                  |
| `origin`          | enum    | `ecommerce`, `event`, `manual`, `imported` |
| `firstPurchaseAt` | text?   | Data da primeira compra                    |
| `lastPurchaseAt`  | text?   | Data da última compra                      |
| `totalOrders`     | integer | Contador de pedidos                        |
| `totalSpentCents` | integer | Total gasto em centavos                    |
| `notes`           | text?   |                                            |
| `status`          | enum    | `active`, `inactive`, `blocked`            |

### `suppliers`

| Campo          | Tipo    | Descrição              |
| -------------- | ------- | ---------------------- |
| `id`           | text PK |                        |
| `partyId`      | text FK |                        |
| `paymentTerms` | text?   | Condições de pagamento |
| `notes`        | text?   |                        |
| `status`       | enum    | `active`, `inactive`   |

---

## Rotas

| Método   | Path                     | Descrição                                                 |
| -------- | ------------------------ | --------------------------------------------------------- |
| `GET`    | `/parties`               | Lista parties (busca por nome/documento, filtro por tipo) |
| `POST`   | `/parties`               | Cria party                                                |
| `GET`    | `/parties/:id`           | Retorna party com endereços                               |
| `PATCH`  | `/parties/:id`           | Atualiza party                                            |
| `DELETE` | `/parties/:id`           | Arquiva (soft delete)                                     |
| `POST`   | `/parties/:id/addresses` | Adiciona endereço                                         |
| `POST`   | `/parties/:id/customer`  | Cria perfil de customer vinculado                         |
| `POST`   | `/parties/:id/supplier`  | Cria perfil de supplier vinculado                         |
| `GET`    | `/customers`             | Lista customers (com dados da party)                      |
| `POST`   | `/customers`             | Cria customer + party em uma operação                     |
| `GET`    | `/customers/:id`         | Retorna customer com party                                |
| `GET`    | `/suppliers`             | Lista suppliers                                           |
| `POST`   | `/suppliers`             | Cria supplier + party                                     |
| `GET`    | `/suppliers/:id`         | Retorna supplier com party                                |

---

## Regras de negócio

- **Uma party pode ser customer e supplier ao mesmo tempo** — vínculos independentes.
- **`cdsConsumerId`** em `parties` e `customers`: preenchido quando a party tem vínculo com o CDS (ex.: criada via ingestão de pedido do e-commerce).
- **Soft delete via `archivedAt`**: parties arquivadas não aparecem em listas mas mantêm integridade referencial.
- **`documentNumber` único por tipo**: CPF/CNPJ não podem se repetir.

---

## Service

`src/services/party.service.ts` — `createPartyService(db)`

Métodos: `create`, `findById`, `findMany`, `update`, `archive`, `addAddress`, `createCustomer`, `createSupplier`, `listCustomers`, `listSuppliers`, `createCustomerWithParty`, `createSupplierWithParty`.
