# Setup local — Tribus ERP

---

## Pré-requisitos

- Node.js 22+
- npm 10+
- Conta Cloudflare (para deploy e D1 local)
- Wrangler CLI (instalado localmente via npm)

---

## Instalação

```bash
# Na raiz do monorepo
npm install
```

---

## Variáveis de ambiente

### API (`apps/erp-api`)

Crie o arquivo `apps/erp-api/.dev.vars` (nunca commitado):

```ini
ENVIRONMENT=development
ERP_INTERNAL_SECRET=qualquer-valor-para-dev
CDS_JWT_SECRET=mesmo-valor-do-cds-local
CDS_JWT_ISSUER=tribus-cds
CDS_JWT_AUDIENCE=tribus-erp
CDS_API_URL=http://localhost:8788
```

Os bindings D1 e R2 em desenvolvimento são simulados pelo Wrangler localmente.

### Web (`apps/erp-web`)

Crie `apps/erp-web/.env.local`:

```ini
ERP_API_URL=http://localhost:8787
ERP_API_INTERNAL_SECRET=mesmo-valor-do-erp-internal-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=qualquer-valor-longo-para-dev
CDS_JWT_SECRET=mesmo-valor-do-cds-local
```

---

## Banco de dados local (D1)

Aplicar migrations no banco local:

```bash
cd apps/erp-api
npx wrangler d1 migrations apply tribus-erp-db --local
```

---

## Rodando a API

```bash
# Na raiz ou em apps/erp-api
npm run dev --workspace=apps/erp-api
# ou
cd apps/erp-api && npx wrangler dev
```

API disponível em: `http://localhost:8787`

Verificar: `curl http://localhost:8787/health`

---

## Rodando o frontend

```bash
npm run dev --workspace=apps/erp-web
# ou
cd apps/erp-web && npm run dev
```

Frontend disponível em: `http://localhost:3000`

---

## Scripts úteis (raiz do monorepo)

| Script                  | Descrição                         |
| ----------------------- | --------------------------------- |
| `npm run typecheck`     | TypeScript em todos os workspaces |
| `npm run lint`          | ESLint em todos os workspaces     |
| `npm run format`        | Prettier (formata arquivos)       |
| `npm run format:check`  | Prettier (verifica sem alterar)   |
| `npm run test`          | Vitest em todos os workspaces     |
| `npm run quality:check` | typecheck + lint + format:check   |

---

## Testes

```bash
# Todos os testes
npm run test

# Apenas erp-api com coverage
cd apps/erp-api && npx vitest run --coverage
```

---

## Git hooks

O projeto usa Husky:

- **pre-commit**: `lint-staged` (lint + format nos arquivos staged)
- **pre-push**: `npm run typecheck`

Os hooks são instalados automaticamente via `npm install` (prepare script).
