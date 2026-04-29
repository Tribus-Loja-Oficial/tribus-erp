# AGENTS.md — Tribus ERP

Instruções para assistentes de código e humanos mantendo consistência com o ecossistema Tribus (Hub, CDS, Storefront, Monitor).

## Stack

- TypeScript strict, Zod, Vitest, ESLint, Prettier, Conventional Commits quando possível.
- API: Hono on Cloudflare Workers, Drizzle ORM, D1, R2.
- Web: Next.js 15 App Router, Tailwind v4, Radix (pacotes instalados), TanStack Query (disponível), NextAuth (credentials MVP).

## Camadas (API)

Ordem de dependência:

`config` → `db` / `storage` → `schemas` (Zod) → `repositories` → `services` → `routes`

Proibido:

- Usar `c.env.TRIBUS_ERP_DB` ou SQL direto dentro de `routes/*` fora do padrão estabelecido (usar `createDb` + services).
- Lógica de negócio pesada em componentes React — a web só orquestra UI e chama a API via **server actions** ou RSC com `erpApiFetch` (sempre no servidor, nunca expor `ERP_API_INTERNAL_SECRET` ao cliente).

## Domínio

- Pessoas: `parties` + perfis `customers` / `suppliers`. Preferir `cds_consumer_id` no party/customer quando houver vínculo CDS.
- Pedidos: `source_system` + `source_external_id` únicos para ingestão idempotente.
- Estoque: sempre via `stock_movements`; não alterar `products.current_stock` sem serviço de inventário.

## Testes

- Colocar testes em `apps/erp-api/tests` (unitários de schemas, services, erros).
- Serviços críticos devem ter cobertura antes de mudanças grandes.

## Commits e PRs

Frases completas, escopo claro (`feat(api):`, `fix(web):`, etc.).

## Referência rápida de rotas públicas internas (Bearer)

- `POST /internal/orders/ingest`
- `POST /internal/fiscal/xml/import`

Payloads validados com Zod nos handlers.
