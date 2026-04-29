# Referência de variáveis de ambiente — Tribus ERP

Referência completa de todas as variáveis de ambiente utilizadas pelo tribus-erp.

Para instruções de configuração, veja [getting-started/environment-variables](../getting-started/environment-variables.md).

---

## API (`apps/erp-api`)

| Variável                 | Obrigatória | Tipo   | Exemplo                      | Descrição                            |
| ------------------------ | ----------- | ------ | ---------------------------- | ------------------------------------ |
| `ENVIRONMENT`            | ✅          | string | `production`                 | Runtime environment                  |
| `ERP_INTERNAL_SECRET`    | ✅          | string | `64f59f36...`                | Bearer token das rotas `/internal/*` |
| `CDS_JWT_SECRET`         | ✅          | string | `676b7447...`                | HS256 secret dos JWTs do CDS         |
| `CDS_JWT_ISSUER`         | ✅          | string | `tribus-cds`                 | Issuer esperado no JWT CDS           |
| `CDS_JWT_AUDIENCE`       | ✅          | string | `tribus-erp`                 | Audience esperado no JWT CDS         |
| `CDS_API_URL`            | ❌          | string | `https://cds.tribus.com`     | URL da API CDS                       |
| `MONITOR_API_URL`        | ❌          | string | `https://monitor.tribus.com` | URL do tribus-monitor                |
| `MONITOR_COVERAGE_TOKEN` | ❌          | string | `oHlcifn-...`                | Token para publicar coverage         |

### Bindings Cloudflare

| Binding         | Tipo       | Nome configurado em `wrangler.toml` |
| --------------- | ---------- | ----------------------------------- |
| `TRIBUS_ERP_DB` | D1Database | `database_name = "tribus-erp-db"`   |
| `TRIBUS_ERP_R2` | R2Bucket   | `bucket_name = "tribus-erp-r2"`     |

---

## Web (`apps/erp-web`)

| Variável                  | Obrigatória | Escopo   | Exemplo                       | Descrição                      |
| ------------------------- | ----------- | -------- | ----------------------------- | ------------------------------ |
| `ERP_API_URL`             | ✅          | Servidor | `https://erp-api.workers.dev` | URL base da erp-api            |
| `ERP_API_INTERNAL_SECRET` | ✅          | Servidor | `64f59f36...`                 | Bearer token erp-web → erp-api |
| `NEXTAUTH_URL`            | ✅          | Servidor | `https://erp.tribus.com`      | URL pública da erp-web         |
| `NEXTAUTH_SECRET`         | ✅          | Servidor | `abc123...`                   | Cifra sessão NextAuth (JWE)    |
| `CDS_JWT_SECRET`          | ✅          | Servidor | `676b7447...`                 | Valida JWT CDS no login        |

---

## GitHub Actions (Environment PROD)

| Variável                 | Usada em              | Descrição              |
| ------------------------ | --------------------- | ---------------------- |
| `CLOUDFLARE_API_TOKEN`   | deploy-production.yml | Token API Cloudflare   |
| `CLOUDFLARE_ACCOUNT_ID`  | deploy-production.yml | ID da conta Cloudflare |
| `MONITOR_API_URL`        | ci.yml                | URL tribus-monitor     |
| `MONITOR_COVERAGE_TOKEN` | ci.yml                | Token coverage         |

---

## Secrets compartilhados entre sistemas

| Secret                                                  | Sistemas que compartilham                    | Propósito                            |
| ------------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| `CDS_JWT_SECRET` = `JWT_SECRET` (CDS)                   | tribus-cds + tribus-erp API + tribus-erp Web | CDS emite JWT; ERP valida            |
| `ERP_INTERNAL_SECRET` = `ERP_API_INTERNAL_SECRET` (Web) | erp-api + erp-web                            | erp-web autentica chamadas à erp-api |
