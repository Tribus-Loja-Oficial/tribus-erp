# Template de tarefa para IA — Tribus ERP

Use este template ao criar prompts para IA (Cursor, Claude, etc.) neste repositório.

---

## Template

```
Leia obrigatoriamente antes de começar:
1. AGENTS.md (raiz)
2. docs/ai-context/project-context.md
3. docs/ai-context/development-rules.md
4. [docs/domains/<domínio>.md se aplicável]
5. [docs/reference/routes.md se a tarefa envolver rotas]
6. [docs/reference/env-vars.md se a tarefa envolver variáveis]

---

## Tarefa

[Descreva o que precisa ser feito]

## Contexto adicional

- Domínio afetado: [ex.: orders, inventory, finance]
- Camadas envolvidas: [ex.: schemas, repositories, services, routes]
- Tabelas relacionadas: [ex.: orders, order_items]
- Rotas afetadas: [ex.: POST /orders, GET /orders/:id]

## Restrições

[Ex.: não alterar tabelas existentes, manter compatibilidade com ingestão do CDS]

## Entrega esperada

- Código implementado seguindo as convenções do projeto
- Testes unitários para o service criado/alterado
- Documentação atualizada (routes.md, env-vars.md, domain doc se aplicável)
- Checklist de entrega do AGENTS.md preenchido
```

---

## Exemplo preenchido

```
Leia obrigatoriamente antes de começar:
1. AGENTS.md (raiz)
2. docs/ai-context/project-context.md
3. docs/ai-context/development-rules.md
4. docs/domains/inventory.md
5. docs/reference/routes.md

---

## Tarefa

Adicionar rota GET /inventory/movements que lista movimentações de estoque com filtros por produto, localização e tipo de movimento. Paginação com limit/offset.

## Contexto adicional

- Domínio afetado: inventory
- Camadas envolvidas: schemas (query params), repositories (nova query), services (opcional), routes
- Tabelas relacionadas: stock_movements, stock_locations, products

## Restrições

- Não alterar a tabela stock_movements
- Manter compatibilidade com os tipos de movimento existentes (11 tipos)

## Entrega esperada

- Nova rota GET /inventory/movements
- Schema Zod para query params
- Query no inventory repository
- Testes unitários do schema
- routes.md atualizado com a nova rota
```
