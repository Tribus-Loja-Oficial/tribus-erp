# Custo médio de componentes (matéria-prima, embalagem, consumível)

## Como é calculado

O custo médio (`products.average_cost_decimal`) é a **média ponderada pela quantidade** das **duas últimas compras** do produto, onde cada compra é um **recebimento de compra** (`purchase_receipt`).

Fórmula:

```
custo_médio = (custo_total_compra_1 + custo_total_compra_2) / (quantidade_1 + quantidade_2)
```

- Se existir só **uma** compra, usa só essa.
- Várias linhas do **mesmo produto no mesmo recebimento** são somadas antes de entrar na conta.
- A unidade de referência (`average_cost_unit`) é a unidade de estoque do **recebimento mais recente**.

O cálculo é atualizado em `createReceipt` (API de recebimento de compra). O fluxo antigo `receive` em ordem de compra **não** atualiza o custo médio.

## Uso na composição (BOM)

Prioridade do custo unitário na linha:

1. **Custo médio** (`average_cost_decimal`), se existir
2. **Custo base** do cadastro (`cost_price_cents`) — legado / manual

O custo proporcional cadastrado (compra/consumo no produto) **foi removido**.

## Backfill após deploy

Recalcular todos os produtos com histórico de recebimento:

```bash
curl -X POST "https://<erp-api>/internal/costs/recalculate-averages" \
  -H "Authorization: Bearer <ERP_INTERNAL_SECRET>"
```

Resposta: `{ "data": { "updated": <n> } }`.

## Auditoria

Eventos em `inventory_valuation_events` registram o custo médio anterior e o novo valor após cada recebimento (método das 2 últimas compras).
