# Deploy — Tribus ERP

---

## API (`erp-api`) — Cloudflare Workers

### Pré-requisitos

- Node.js 22+
- `npm install` na raiz do monorepo
- Conta Cloudflare com Worker `tribus-erp-api` criado
- D1 `tribus-erp-db` e R2 `tribus-erp-r2` criados e com IDs configurados no `wrangler.toml`

### Deploy manual

```bash
cd apps/erp-api
npx wrangler deploy
```

Aplica migrations antes do deploy em produção:

```bash
npx wrangler d1 migrations apply tribus-erp-db --remote
npx wrangler deploy
```

### Deploy automático (CI/CD)

O deploy de produção é acionado automaticamente pelo GitHub Actions após o CI passar em push para `main`.

Workflow: `.github/workflows/deploy-production.yml`

Passos:

1. CI (`ci.yml`) executa: typecheck, Prettier, ESLint, Vitest, coverage snapshot.
2. Deploy Production aguarda o CI verde (via `workflow_run`).
3. Executa `wrangler d1 migrations apply` (migrations).
4. Executa `wrangler deploy` (deploy do Worker).

Credenciais necessárias no **GitHub Environment `PROD`**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

---

## Web (`erp-web`) — Vercel

> Deploy da erp-web ainda não está automatizado. A ser definido.

### Deploy manual (Vercel CLI)

```bash
cd apps/erp-web
vercel --prod
```

### Variáveis de ambiente necessárias (Vercel)

| Variável                  | Descrição                               |
| ------------------------- | --------------------------------------- |
| `ERP_API_URL`             | URL da erp-api em produção              |
| `ERP_API_INTERNAL_SECRET` | Secret para autenticar chamadas API→ERP |
| `NEXTAUTH_URL`            | URL pública da erp-web                  |
| `NEXTAUTH_SECRET`         | Secret para cifrar sessão NextAuth      |
| `CDS_JWT_SECRET`          | Secret para validar JWT do CDS          |

---

## Variáveis de ambiente do Worker (Cloudflare)

Configuradas no dashboard Cloudflare ou via `wrangler.toml` (vars):

| Variável                 | Descrição                        |
| ------------------------ | -------------------------------- |
| `ENVIRONMENT`            | `development` ou `production`    |
| `ERP_INTERNAL_SECRET`    | Autentica rotas `/internal/*`    |
| `CDS_JWT_SECRET`         | Valida JWT do CDS                |
| `CDS_API_URL`            | URL da API do CDS (opcional)     |
| `CDS_JWT_ISSUER`         | Issuer esperado no JWT CDS       |
| `CDS_JWT_AUDIENCE`       | Audience esperado no JWT CDS     |
| `MONITOR_API_URL`        | URL do tribus-monitor (coverage) |
| `MONITOR_COVERAGE_TOKEN` | Token para publicar coverage     |

Bindings D1 e R2 configurados em `wrangler.toml`:

- `TRIBUS_ERP_DB` → D1 database
- `TRIBUS_ERP_R2` → R2 bucket

---

## Migrations

Migrations gerenciadas pelo Drizzle Kit em `apps/erp-api/src/db/migrations/`.

Para criar nova migration após alterar o schema:

```bash
cd apps/erp-api
npx drizzle-kit generate
```

Para aplicar em produção (remoto):

```bash
npx wrangler d1 migrations apply tribus-erp-db --remote
```

Para aplicar localmente (desenvolvimento):

```bash
npx wrangler d1 migrations apply tribus-erp-db --local
```

---

## Verificação pós-deploy

```bash
curl https://tribus-erp-api.{account}.workers.dev/health
# → { "status": "ok", "timestamp": "..." }
```
