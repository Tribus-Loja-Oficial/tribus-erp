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

### Deploy automático (CI/CD)

O deploy de produção é acionado automaticamente após o CI passar em push para `main`.

Workflow: `.github/workflows/deploy-erp-web-vercel.yml`

Passos:

1. CI (`ci.yml`) executa: typecheck, lint, testes, build do erp-web, coverage snapshot.
2. Deploy Vercel aguarda o CI verde (via `workflow_run`).
3. `npm ci` + `npm run build -w @tribus-erp/core && npm run build -w @tribus-erp/web`
4. `vercel deploy --prod` a partir de `apps/erp-web/`.

Pull requests geram **preview deploys** automaticamente.

Credenciais necessárias no **GitHub Environment `PROD`**:

| Variável                  | Descrição                                   |
| ------------------------- | ------------------------------------------- |
| `VERCEL_TOKEN`            | Token da API Vercel                         |
| `VERCEL_ORG_ID`           | ID da organização Vercel                    |
| `VERCEL_PROJECT_ID`       | ID do projeto erp-web na Vercel             |
| `ERP_API_URL`             | URL da erp-api em produção (usada no build) |
| `ERP_API_INTERNAL_SECRET` | Secret erp-web → erp-api (usada no build)   |
| `AUTH_SECRET`             | Secret NextAuth (usada no build)            |

### Setup inicial do projeto Vercel

Antes do primeiro deploy automático, vincular o projeto manualmente:

```bash
cd apps/erp-web
npx vercel link
# Escolher a organização e criar/vincular o projeto
```

Isso cria `apps/erp-web/.vercel/project.json` com `projectId` e `orgId` — commitar este arquivo.

### Deploy manual (Vercel CLI)

```bash
cd apps/erp-web
ERP_API_URL=... ERP_API_INTERNAL_SECRET=... AUTH_SECRET=... vercel --prod
```

### Variáveis de ambiente de runtime (Vercel Dashboard)

Configurar no dashboard Vercel → Settings → Environment Variables:

| Variável                  | Descrição                               |
| ------------------------- | --------------------------------------- |
| `ERP_API_URL`             | URL da erp-api em produção              |
| `ERP_API_INTERNAL_SECRET` | Secret para autenticar chamadas API→ERP |
| `NEXTAUTH_URL`            | URL pública da erp-web                  |
| `AUTH_SECRET`             | Secret para cifrar sessão NextAuth      |
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

### Fila de ingestão assíncrona (Cloudflare Queues)

A ingestão em segundo plano usa uma **Queue** e a tabela D1 **`ingestion_jobs`** (migrações `0012_ingestion_jobs.sql` e `0013_ingestion_jobs_chunk_state.sql` para `chunk_state_json` entre chunks). Sem fila configurada, `POST /internal/ingestion/jobs` responde **503** (`QUEUE_UNAVAILABLE`) e a UI mostra erro claro.

1. Criar a fila (nome alinhado ao `wrangler.toml`, ex. `tribus-erp-ingestion-queue`):

   ```bash
   cd apps/erp-api
   npx wrangler queues create tribus-erp-ingestion-queue
   ```

   Ou criar no dashboard Cloudflare → Queues.

2. O `wrangler.toml` já declara producer/consumer com binding **`INGESTION_QUEUE`** e `max_batch_size = 1` no consumer de ingestão.

3. Aplicar migrations D1 (inclui `ingestion_jobs`) antes ou no mesmo ciclo de deploy:

   ```bash
   npx wrangler d1 migrations apply tribus-erp-db --remote
   ```

**erp-web (opcional):** `INGESTION_SYNC_MAX_OBJECTS`, `INGESTION_SYNC_MAX_BODY_BYTES` — limiares acima dos quais `POST /api/admin/ingestion/execute` usa o modo assíncrono (ver `ingestion-sync-thresholds.ts`).

**erp-api / Worker (opcional):** `INGESTION_QUEUE_CHUNK_SIZE` — objectos por invocação do consumer (por defeito **10**; máx. **200** no código). No **plano Free**, reduzir (ex. `3`–`5` ou `1`) se aparecer `exceededCpu`.

**Workers Paid:** podes adicionar ao `wrangler.toml` uma secção `[limits]` / `[env.production.limits]` com `cpu_ms` (ver [documentação](https://developers.cloudflare.com/workers/wrangler/configuration/#limits)). No **plano Free** essa secção **não** é permitida — o `wrangler deploy` falha com erro `100328`.

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
