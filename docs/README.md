# Documentação — Tribus ERP

Índice central da documentação do **tribus-erp**. Toda a doc está em português (PT-BR).

**Para IA (Cursor, Claude, etc.):** leia **[AGENTS.md](../AGENTS.md)** na raiz do repositório e use o contexto em **[ai-context/](ai-context/project-context.md)** antes de qualquer tarefa.

---

## Navegação por objetivo

**Se você é novo no projeto:**

- [getting-started/setup](getting-started/setup.md) — rodar o projeto na máquina.
- [architecture/overview](architecture/overview.md) — visão geral e papel do ERP.
- [architecture/layers](architecture/layers.md) — camadas da API e da Web.

**Se vai trabalhar em um domínio:**

- [domains/orders](domains/orders.md) — pedidos e ingestão.
- [domains/inventory](domains/inventory.md) — estoque e movimentações.
- [domains/finance](domains/finance.md) — financeiro (contas, lançamentos).
- [domains/fiscal](domains/fiscal.md) — documentos fiscais (NFe).
- [domains/production](domains/production.md) — ordens de produção e BOM.

**Se vai depurar problemas:**

- [operations/deploy](operations/deploy.md) — deploy da API e da Web.
- [operations/monitoring](operations/monitoring.md) — logs, request ID, observabilidade.
- [reference/env-vars](reference/env-vars.md) — variáveis de ambiente.

---

## Começando

| Documento                                                                         | Conteúdo                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [getting-started/setup](getting-started/setup.md)                                 | Setup local, dependências, como rodar o projeto.         |
| [getting-started/environment-variables](getting-started/environment-variables.md) | Variáveis de ambiente: onde definir, validação, exemplo. |

---

## Arquitetura

| Documento                                                         | Conteúdo                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| [architecture/overview](architecture/overview.md)                 | Visão geral do repositório e papel do ERP na plataforma Tribus.       |
| [architecture/layers](architecture/layers.md)                     | Camadas da API e da Web; responsabilidades e restrições.              |
| [architecture/folder-structure](architecture/folder-structure.md) | Estrutura de pastas do monorepo.                                      |
| [architecture/decisions](architecture/decisions.md)               | Decisões arquiteturais: por que Cloudflare Workers, Drizzle, D1, etc. |

---

## Domínios

| Documento                                   | Conteúdo                                                          |
| ------------------------------------------- | ----------------------------------------------------------------- |
| [domains/parties](domains/parties.md)       | Pessoas: parties, customers, suppliers e vínculo com CDS.         |
| [domains/orders](domains/orders.md)         | Pedidos: ingestão, ciclo de vida, source_system, idempotência.    |
| [domains/products](domains/products.md)     | Produtos, variantes, categorias, coleções e tags.                 |
| [domains/inventory](domains/inventory.md)   | Estoque: locais, movimentações, tipos de movimento.               |
| [domains/finance](domains/finance.md)       | Financeiro: plano de contas, lançamentos, contas a pagar/receber. |
| [domains/fiscal](domains/fiscal.md)         | Fiscal: documentos fiscais, itens, importação de XML.             |
| [domains/purchases](domains/purchases.md)   | Compras: ordens de compra e itens.                                |
| [domains/production](domains/production.md) | Produção: BOM, ordens de produção, consumos e perdas.             |

---

## Operações

| Documento                                         | Conteúdo                                                   |
| ------------------------------------------------- | ---------------------------------------------------------- |
| [operations/deploy](operations/deploy.md)         | Deploy: API (Cloudflare Workers) e Web (Vercel), CI/CD.    |
| [operations/monitoring](operations/monitoring.md) | Monitoramento: logs, request ID, Cloudflare Observability. |

---

## Convenções

| Documento                                       | Conteúdo                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| [conventions/code](conventions/code.md)         | Regras de código: proibido vs obrigatório (camadas, schemas, logger). |
| [conventions/security](conventions/security.md) | Segurança: secrets, autenticação, rotas internas.                     |

---

## Referência

| Documento                                                                             | Conteúdo                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [reference/routes](reference/routes.md)                                               | Rotas da API: método, path, autenticação, service, erros. |
| [reference/storage-r2-and-document-files](reference/storage-r2-and-document-files.md) | Prefixos R2, `document_files`, mídia de produto.          |
| [reference/env-vars](reference/env-vars.md)                                           | Variáveis de ambiente: obrigatoriedade, escopo, exemplo.  |

---

## Contexto para IA

| Documento                                                       | Conteúdo                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [AGENTS.md](../AGENTS.md) (raiz)                                | Guia obrigatório para IA: leitura obrigatória, regras, checklist de entrega. |
| [ai-context/project-context](ai-context/project-context.md)     | Contexto canônico do projeto: visão geral, camadas, domínios, integrações.   |
| [ai-context/development-rules](ai-context/development-rules.md) | Regras de arquitetura, documentação e implementação.                         |
| [ai-context/task-template](ai-context/task-template.md)         | Template reutilizável de prompt para tarefas.                                |
