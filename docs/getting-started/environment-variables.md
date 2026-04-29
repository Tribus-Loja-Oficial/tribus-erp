# Variáveis de ambiente — Tribus ERP

---

## API (`apps/erp-api`) — Cloudflare Worker

Lidas via `src/config/env.ts` → `getEnv(c.env)`. Variáveis inválidas ou ausentes causam erro na inicialização.

| Variável                 | Obrigatória | Descrição                                    |
| ------------------------ | ----------- | -------------------------------------------- |
| `ENVIRONMENT`            | Sim         | `development` ou `production`                |
| `ERP_INTERNAL_SECRET`    | Sim         | Autentica rotas `/internal/*` (Bearer token) |
| `CDS_JWT_SECRET`         | Sim         | Valida JWTs emitidos pelo CDS                |
| `CDS_JWT_ISSUER`         | Sim         | Issuer esperado no JWT do CDS                |
| `CDS_JWT_AUDIENCE`       | Sim         | Audience esperado no JWT do CDS              |
| `CDS_API_URL`            | Não         | URL da API CDS (para chamadas opcionais)     |
| `MONITOR_API_URL`        | Não         | URL do tribus-monitor (coverage publishing)  |
| `MONITOR_COVERAGE_TOKEN` | Não         | Token de auth para publicar coverage         |

### Bindings (configurados em `wrangler.toml`)

| Binding         | Tipo       | Descrição                           |
| --------------- | ---------- | ----------------------------------- |
| `TRIBUS_ERP_DB` | D1Database | Banco de dados SQLite (D1)          |
| `TRIBUS_ERP_R2` | R2Bucket   | Armazenamento de documentos fiscais |

### Como configurar

**Desenvolvimento:** arquivo `apps/erp-api/.dev.vars` (não versionado):

```ini
ENVIRONMENT=development
ERP_INTERNAL_SECRET=dev-secret-local
CDS_JWT_SECRET=dev-jwt-secret
CDS_JWT_ISSUER=tribus-cds
CDS_JWT_AUDIENCE=tribus-erp
```

**Produção:** dashboard Cloudflare Workers → Settings → Variables (ou `wrangler.toml` → `[env.production.vars]`).

---

## Web (`apps/erp-web`) — Next.js

Lidas via `src/lib/config/env.ts`. Prefixo `NEXT_PUBLIC_` expõe ao browser — nunca usar com secrets.

| Variável                  | Obrigatória | Escopo   | Descrição                                        |
| ------------------------- | ----------- | -------- | ------------------------------------------------ |
| `ERP_API_URL`             | Sim         | Servidor | URL base da erp-api                              |
| `ERP_API_INTERNAL_SECRET` | Sim         | Servidor | Bearer token para autenticar erp-web → erp-api   |
| `NEXTAUTH_URL`            | Sim         | Servidor | URL pública da erp-web (para callbacks NextAuth) |
| `NEXTAUTH_SECRET`         | Sim         | Servidor | Secret para cifrar sessão NextAuth (JWE)         |
| `CDS_JWT_SECRET`          | Sim         | Servidor | Secret para validar JWT CDS no login             |

### Como configurar

**Desenvolvimento:** arquivo `apps/erp-web/.env.local` (não versionado):

```ini
ERP_API_URL=http://localhost:8787
ERP_API_INTERNAL_SECRET=dev-secret-local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=um-valor-longo-qualquer-para-dev
CDS_JWT_SECRET=dev-jwt-secret
```

**Produção:** dashboard Vercel → Settings → Environment Variables.

---

## GitHub Actions (CI/CD)

Configuradas no **GitHub Environment `PROD`** (Settings → Environments → PROD):

| Variável                 | Usada em                | Descrição                                        |
| ------------------------ | ----------------------- | ------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`   | `deploy-production.yml` | Token da API Cloudflare para deploy via Wrangler |
| `CLOUDFLARE_ACCOUNT_ID`  | `deploy-production.yml` | ID da conta Cloudflare                           |
| `MONITOR_API_URL`        | `ci.yml` (coverage)     | URL do tribus-monitor                            |
| `MONITOR_COVERAGE_TOKEN` | `ci.yml` (coverage)     | Token para publicar coverage                     |

---

## Geração de valores seguros

Para gerar valores de secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
