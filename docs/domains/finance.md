# Domínio: Finance — Tribus ERP

Gerencia o financeiro da operação: plano de contas, lançamentos de receita/despesa, contas a pagar e contas a receber.

---

## Modelo de dados

### `chart_of_accounts`

| Campo      | Tipo     | Descrição                                            |
| ---------- | -------- | ---------------------------------------------------- |
| `id`       | text PK  |                                                      |
| `code`     | text     | Código contábil (ex.: `1.1.01`)                      |
| `name`     | text     | Nome da conta                                        |
| `type`     | enum     | `revenue`, `expense`, `asset`, `liability`, `equity` |
| `parentId` | text FK? | Conta pai (hierarquia)                               |
| `isActive` | boolean  |                                                      |

### `cost_centers`

| Campo         | Tipo    | Descrição                                   |
| ------------- | ------- | ------------------------------------------- |
| `id`          | text PK |                                             |
| `name`        | text    | Ex.: "Produção", "Vendas", "Administrativo" |
| `description` | text?   |                                             |
| `isActive`    | boolean |                                             |

### `financial_accounts`

| Campo          | Tipo    | Descrição                                  |
| -------------- | ------- | ------------------------------------------ |
| `id`           | text PK |                                            |
| `name`         | text    | Ex.: "Conta Corrente Itaú", "Caixa Físico" |
| `type`         | enum    | `bank`, `cash`, `credit_card`              |
| `balanceCents` | integer | Saldo atual em centavos                    |
| `isActive`     | boolean |                                            |

### `financial_entries`

| Campo            | Tipo     | Descrição                        |
| ---------------- | -------- | -------------------------------- |
| `id`             | text PK  |                                  |
| `accountId`      | text FK  | Conta financeira                 |
| `chartAccountId` | text FK? | Conta do plano                   |
| `costCenterId`   | text FK? | Centro de custo                  |
| `type`           | enum     | `revenue`, `expense`, `transfer` |
| `amountCents`    | integer  | Valor em centavos                |
| `description`    | text     | Descrição do lançamento          |
| `reference`      | text?    | ID externo relacionado           |
| `entryDate`      | text     | Data de competência (ISO 8601)   |
| `createdAt`      | text     | ISO 8601                         |

### `accounts_payable`

| Campo         | Tipo     | Descrição                                            |
| ------------- | -------- | ---------------------------------------------------- |
| `id`          | text PK  |                                                      |
| `supplierId`  | text FK? |                                                      |
| `description` | text     |                                                      |
| `amountCents` | integer  | Valor total                                          |
| `paidCents`   | integer  | Valor pago até agora                                 |
| `status`      | enum     | `pending`, `partial`, `paid`, `overdue`, `cancelled` |
| `dueDate`     | text     | Data de vencimento                                   |
| `paidAt`      | text?    |                                                      |
| `reference`   | text?    | Ex.: purchaseOrderId                                 |

### `accounts_receivable`

| Campo           | Tipo     | Descrição                                                |
| --------------- | -------- | -------------------------------------------------------- |
| `id`            | text PK  |                                                          |
| `customerId`    | text FK? |                                                          |
| `description`   | text     |                                                          |
| `amountCents`   | integer  |                                                          |
| `receivedCents` | integer  | Valor recebido                                           |
| `status`        | enum     | `pending`, `partial`, `received`, `overdue`, `cancelled` |
| `dueDate`       | text     |                                                          |
| `receivedAt`    | text?    |                                                          |
| `reference`     | text?    | Ex.: orderId                                             |

---

## Rotas

| Método | Path                               | Descrição                               |
| ------ | ---------------------------------- | --------------------------------------- |
| `GET`  | `/finance/dashboard`               | Resumo financeiro por período           |
| `GET`  | `/finance/accounts`                | Lista contas financeiras                |
| `POST` | `/finance/accounts`                | Cria conta                              |
| `GET`  | `/finance/chart-of-accounts`       | Lista plano de contas                   |
| `GET`  | `/finance/cost-centers`            | Lista centros de custo                  |
| `GET`  | `/finance/entries`                 | Lista lançamentos                       |
| `POST` | `/finance/entries`                 | Cria lançamento                         |
| `GET`  | `/finance/payables`                | Lista contas a pagar (paginado)         |
| `POST` | `/finance/payables`                | Cria conta a pagar                      |
| `POST` | `/finance/payables/:id/pay`        | Registra pagamento (total ou parcial)   |
| `GET`  | `/finance/receivables`             | Lista contas a receber (paginado)       |
| `POST` | `/finance/receivables`             | Cria conta a receber                    |
| `POST` | `/finance/receivables/:id/receive` | Registra recebimento (total ou parcial) |

---

## Regras de negócio

- **Pagamento parcial**: `accounts_payable` e `accounts_receivable` suportam pagamentos parciais; `paidCents` / `receivedCents` acumulam até atingir `amountCents`.
- **Status automático**: ao pagar totalmente (`paidCents >= amountCents`), status muda para `paid`/`received`.
- **Lançamento duplo**: cada pagamento de payable/receivable gera um `financial_entry` correspondente na conta financeira.
- **Todos os valores em centavos** (inteiros).

---

## Service

`src/services/finance.service.ts` — `createFinanceService(db)`

Métodos: `findAccounts`, `createAccount`, `findChartOfAccounts`, `findCostCenters`, `createEntry`, `findEntries`, `findPayables`, `createPayable`, `payPayable`, `findReceivables`, `createReceivable`, `receiveReceivable`, `getDashboardSummary`.
