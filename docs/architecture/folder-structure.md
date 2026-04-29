# Estrutura de pastas — Tribus ERP

```
tribus-erp/
├── apps/
│   ├── erp-api/                    — Cloudflare Worker (API Hono + Drizzle)
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   └── env.ts          — Validação de variáveis de ambiente (Zod)
│   │   │   ├── db/
│   │   │   │   ├── schema/
│   │   │   │   │   └── index.ts    — Schema Drizzle completo (todas as tabelas)
│   │   │   │   ├── client.ts       — createDb() — instancia cliente D1
│   │   │   │   └── migrations/     — Arquivos SQL de migração
│   │   │   ├── storage/
│   │   │   │   └── r2.ts           — Provider R2 para documentos fiscais
│   │   │   ├── schemas/            — Schemas Zod por domínio (validação de inputs)
│   │   │   │   ├── orders.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── finance.ts
│   │   │   │   └── ...
│   │   │   ├── repositories/       — Queries Drizzle por entidade
│   │   │   │   ├── order.repository.ts
│   │   │   │   ├── party.repository.ts
│   │   │   │   ├── inventory.repository.ts
│   │   │   │   └── ...
│   │   │   ├── services/           — Lógica de negócio por domínio
│   │   │   │   ├── order.service.ts
│   │   │   │   ├── party.service.ts
│   │   │   │   ├── inventory.service.ts
│   │   │   │   ├── finance.service.ts
│   │   │   │   ├── fiscal.service.ts
│   │   │   │   ├── purchase.service.ts
│   │   │   │   ├── pos.service.ts
│   │   │   │   ├── production.service.ts
│   │   │   │   └── reports.service.ts
│   │   │   ├── routes/             — Handlers Hono (14 grupos de rotas)
│   │   │   │   ├── health.ts
│   │   │   │   ├── parties.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── suppliers.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── pos.ts
│   │   │   │   ├── finance.ts
│   │   │   │   ├── fiscal.ts
│   │   │   │   ├── purchases.ts
│   │   │   │   ├── production.ts
│   │   │   │   ├── reports.ts
│   │   │   │   └── internal.ts
│   │   │   ├── errors/             — AppError, NotFoundError, BadRequestError
│   │   │   ├── observability/      — logger.ts, request-id middleware
│   │   │   ├── utils/              — generateId(), helpers
│   │   │   ├── types/              — Env (bindings do Worker)
│   │   │   └── index.ts            — Entry point: registra rotas e middleware
│   │   ├── wrangler.toml           — Configuração do Worker (D1, R2, vars)
│   │   ├── vitest.config.ts        — Configuração de testes
│   │   └── package.json
│   │
│   └── erp-web/                    — Next.js App Router (frontend interno)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   └── login/      — Tela de login
│       │   │   └── (dashboard)/    — Área autenticada
│       │   │       ├── layout.tsx  — Layout com sidebar/header
│       │   │       ├── page.tsx    — Dashboard principal
│       │   │       ├── orders/     — Gestão de pedidos
│       │   │       ├── products/   — Catálogo de produtos
│       │   │       ├── customers/  — Clientes
│       │   │       ├── suppliers/  — Fornecedores
│       │   │       ├── inventory/  — Estoque
│       │   │       ├── finance/    — Financeiro
│       │   │       ├── fiscal/     — Documentos fiscais
│       │   │       ├── purchases/  — Compras
│       │   │       ├── production/ — Produção
│       │   │       ├── reports/    — Relatórios
│       │   │       └── pos/        — Ponto de venda
│       │   ├── components/
│       │   │   ├── layout/         — header.tsx, sidebar.tsx
│       │   │   └── ui/             — Componentes reutilizáveis
│       │   ├── lib/
│       │   │   ├── api/            — erpApiFetch (HTTP client)
│       │   │   ├── auth/           — NextAuth config
│       │   │   ├── config/         — env.ts (lê env vars server)
│       │   │   └── errors/         — Tratamento de erros
│       │   └── server/             — Server Actions
│       └── package.json
│
├── packages/
│   └── core/                       — Código compartilhado
│       └── src/
│           ├── types.ts            — 67+ tipos de domínio
│           └── schemas.ts          — Schemas Zod reutilizáveis
│
├── docs/                           — Documentação completa
├── scripts/
│   └── publish-coverage.mjs        — Publica coverage no tribus-monitor
├── .github/
│   └── workflows/
│       ├── ci.yml                  — Build, lint, typecheck, testes, coverage
│       └── deploy-production.yml   — Deploy via Wrangler após CI verde
├── .husky/
│   ├── pre-commit                  — lint-staged
│   └── pre-push                    — npm run typecheck
├── AGENTS.md                       — Guia obrigatório para IA
├── package.json                    — Scripts do monorepo (workspace root)
└── tsconfig.base.json              — TypeScript base config
```

---

## Convenções de nomenclatura

| Tipo                      | Convenção             | Exemplo                         |
| ------------------------- | --------------------- | ------------------------------- |
| Arquivos da API           | `camelCase.ts`        | `order.service.ts`              |
| Paths de rota             | `kebab-case`          | `/purchase-orders`              |
| Componentes Web           | `PascalCase.tsx`      | `OrderCard.tsx`                 |
| Alias de importação (Web) | `@/` → `src/`         | `import { X } from '@/lib/api'` |
| Tabelas DB                | `snake_case`          | `stock_movements`               |
| Colunas DB                | `camelCase` (Drizzle) | `createdAt`, `unitPriceCents`   |
