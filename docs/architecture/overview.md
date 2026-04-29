# Visão geral da arquitetura — Tribus ERP

## O que é o tribus-erp

Sistema interno de gestão operacional, comercial, financeira e fiscal da Tribus. Concentra pedidos, estoque, financeiro, fiscal, produção e compras em um único backend, acessado apenas por usuários internos autenticados e por sistemas Tribus via rotas internas.

---

## Papel na plataforma Tribus

```
CDS (e-commerce)
    │  POST /internal/orders/ingest
    ▼
tribus-erp API ──── D1 (SQLite) ─── Drizzle ORM
    │                │
    │                └── R2 (XMLs fiscais)
    ▼
erp-web (Next.js)  ←── usuários internos (autenticados)
```

- **Recebe pedidos** do CDS via ingestão autenticada com `ERP_INTERNAL_SECRET`.
- **Gerencia estoque** com rastreamento por locais e movimentações tipificadas.
- **Controle financeiro** com lançamentos de receita/despesa, contas a pagar/receber.
- **Fiscal** com importação e armazenamento de XMLs de NF-e.
- **Produção** com ordens de produção e BOM.
- **Não é público:** nenhuma rota sem autenticação exceto `/health`.

---

## Tecnologias principais

| Camada           | Tecnologia                |
| ---------------- | ------------------------- |
| Runtime          | Cloudflare Workers        |
| Framework API    | Hono                      |
| ORM              | Drizzle                   |
| Banco de dados   | Cloudflare D1 (SQLite)    |
| Armazenamento    | Cloudflare R2             |
| Validação        | Zod                       |
| Frontend         | Next.js 14 (App Router)   |
| Autenticação Web | NextAuth (credentials)    |
| Linguagem        | TypeScript (strict)       |
| Testes           | Vitest                    |
| CI/CD            | GitHub Actions + Wrangler |

---

## Estrutura do monorepo

```
tribus-erp/
├── apps/
│   ├── erp-api/      — Cloudflare Worker (API Hono)
│   └── erp-web/      — Next.js App Router (frontend interno)
├── packages/
│   └── core/         — Tipos TypeScript e schemas Zod compartilhados
├── docs/             — Documentação completa
└── scripts/          — Scripts auxiliares (CI, coverage)
```

---

## Fluxo de uma request

```
Client/CDS
  │
  ▼
Hono middleware (CORS, request-id, logger)
  │
  ▼
Route handler
  │  valida com Zod schema (src/schemas/)
  ▼
Service (src/services/)
  │  lógica de negócio
  ▼
Repository (src/repositories/)
  │  queries Drizzle
  ▼
D1 (SQLite)
```

---

## Documentação relacionada

- [Camadas](layers.md) — responsabilidades de cada camada
- [Estrutura de pastas](folder-structure.md) — detalhamento de cada diretório
- [Decisões arquiteturais](decisions.md) — por que cada tecnologia foi escolhida
