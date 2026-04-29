# Tribus ERP

Sistema interno de gestão operacional, comercial, financeira e fiscal da Tribus. Monorepo com **API** (Cloudflare Workers + Hono + Drizzle + D1 + R2) e **Web** (Next.js App Router).

## Requisitos

- Node.js 22+
- Conta Cloudflare (D1, Workers, R2) para deploy da API
- Vercel (ou outro host) para o frontend

## Estrutura

```
apps/
  erp-api/    # Worker Hono — rotas REST, serviços, repositórios Drizzle
  erp-web/    # Next.js — UI operacional, chama a API com segredo apenas no servidor
packages/
  core/       # Tipos e utilidades compartilhadas
```

## Configuração

1. Copie `.env.example` para `apps/erp-web/.env.local` e ajuste URLs e segredos.
2. Na API, defina secrets do Wrangler: `ERP_INTERNAL_SECRET`, `CDS_JWT_SECRET` (veja `apps/erp-api/wrangler.toml`).
3. Atualize o `database_id` do D1 em `wrangler.toml` com o ID real.

### Variáveis principais (Web)

| Variável | Descrição |
|----------|-----------|
| `ERP_API_URL` | URL base do Worker (ex.: `http://127.0.0.1:8787` em dev) |
| `ERP_API_INTERNAL_SECRET` | Bearer compartilhado com a API (≥ 32 caracteres) |
| `AUTH_SECRET` | Segredo NextAuth |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Login inicial (substitua em produção) |

## Desenvolvimento

```bash
npm install
# Terminal 1 — API
npm run dev:api
# Terminal 2 — Web (com .env.local configurado)
npm run dev:web
```

Migrações D1 (local):

```bash
cd apps/erp-api && npm run db:migrate:local
```

## Scripts raiz

- `npm run build` — build core + api + web
- `npm run typecheck` / `npm run lint` / `npm run test`
- `npm run quality:check` — format + types + lint + coverage

## Arquitetura (API)

Regra geral: **rotas** validam com Zod e chamam **services**; services usam **repositórios**; Drizzle e D1 ficam atrás de `createDb` / repositórios. R2 acessível apenas via `StorageProvider`. Integrações internas: `POST /internal/orders/ingest` e `POST /internal/fiscal/xml/import` com `Authorization: Bearer <ERP_INTERNAL_SECRET>`.

Documentação de convenções para agentes: **AGENTS.md**.

## Licença

Uso interno Tribus.
