# Contexto canônico do projeto — Tribus ERP

Este arquivo é o **resumo canônico** do **tribus-erp** para uso por IA. Permite entender o sistema sem ler toda a documentação. Deve ser mantido atualizado quando a arquitetura, domínios ou integrações mudarem.

---

## 1. Visão geral do projeto

- **O que é:** sistema interno de gestão operacional, comercial, financeira e fiscal da Tribus. Monorepo com API (Cloudflare Workers) e Web (Next.js App Router).
- **Papel na plataforma Tribus:** backend interno centralizado. Recebe pedidos do CDS via ingestão (`POST /internal/orders/ingest`), gerencia estoque, financeiro, fiscal, produção e compras.
- **Não é público:** o ERP é acessado apenas por usuários internos autenticados. A API não tem rotas públicas sem autenticação exceto `/health`.

---

## 2. Arquitetura em camadas

### API (`apps/erp-api`) — Cloudflare Worker + Hono

Ordem estrita: **config → db/storage → schemas → repositories → services → routes**

| Camada           | Onde                | Responsabilidade                                                |
| ---------------- | ------------------- | --------------------------------------------------------------- |
| **Config**       | `src/config/env.ts` | Ler e validar variáveis de ambiente do Worker (`c.env`).        |
| **DB**           | `src/db/`           | Schema Drizzle, cliente D1, migrations.                         |
| **Storage**      | `src/storage/`      | Acesso ao R2 (documentos fiscais, arquivos).                    |
| **Schemas**      | `src/schemas/`      | Validação Zod de inputs de rotas.                               |
| **Repositories** | `src/repositories/` | Acesso ao banco de dados via Drizzle. Sem lógica de negócio.    |
| **Services**     | `src/services/`     | Lógica de negócio e orquestração. Chamam repositories.          |
| **Routes**       | `src/routes/`       | Receber request, validar com schema, chamar service, responder. |

### Web (`apps/erp-web`) — Next.js App Router

- Lógica de negócio somente no servidor (Server Components + Server Actions).
- Chama a API via `erpApiFetch` com `ERP_API_INTERNAL_SECRET` — nunca exposto ao client.
- Auth via NextAuth credentials: valida email/senha contra o CDS.

### Core (`packages/core`)

- Tipos TypeScript compartilhados e schemas Zod reutilizáveis entre API e Web.

---

## 3. Estrutura de pastas relevante

```
apps/
  erp-api/src/
    config/        — env.ts (valida c.env)
    db/            — schema/, migrations/, client.ts
    storage/       — R2 provider
    schemas/       — Zod schemas por domínio
    repositories/  — queries Drizzle por entidade
    services/      — lógica de negócio por domínio
    routes/        — handlers Hono (14 rotas)
    errors/        — AppError, NotFoundError, BadRequestError
    observability/ — logger, request-id
    utils/         — generateId, etc.
    types/         — Env (bindings do Worker)
  erp-web/src/
    app/           — App Router: (auth)/, (dashboard)/
    components/    — UI components
    lib/           — api/, auth/, config/, errors/
    server/        — server actions
packages/
  core/src/
    types.ts       — 67+ tipos de domínio
    schemas.ts     — schemas Zod compartilhados
```

---

## 4. Domínios principais

| Domínio        | Tabelas principais                                                                  | Rotas                            |
| -------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| **Parties**    | `parties`, `party_addresses`                                                        | `/parties`                       |
| **Customers**  | `customers`                                                                         | `/customers`                     |
| **Suppliers**  | `suppliers`                                                                         | `/suppliers`                     |
| **Products**   | `products`, `product_variants`, `product_categories`                                | `/products`                      |
| **Inventory**  | `stock_locations`, `stock_movements`                                                | `/inventory`                     |
| **Orders**     | `orders`, `order_items`, `order_payments`                                           | `/orders`                        |
| **Finance**    | `chart_of_accounts`, `financial_entries`, `accounts_payable`, `accounts_receivable` | `/finance`                       |
| **Fiscal**     | `fiscal_documents`, `fiscal_document_items`                                         | `/fiscal`                        |
| **Purchases**  | `purchase_orders`, `purchase_order_items`                                           | `/purchases`                     |
| **Production** | `bill_of_materials`, `bom_items`, `production_orders`                               | `/production`                    |
| **POS**        | `cash_registers`, `cash_sessions`, `cash_movements`                                 | `/pos`                           |
| **Reports**    | — (agrega dados existentes)                                                         | `/reports`                       |
| **Internal**   | —                                                                                   | `/internal` (Bearer autenticado) |

---

## 5. CI/CD (resumo)

- **CI:** **Build & quality checks** (`ci.yml`) — em push/PR para `main` e `development`: typecheck, Prettier, ESLint, testes (Vitest), coverage do erp-api publicado no monitor (Node 22, Ubuntu).
- **CD:** **Deploy production** (`deploy-production.yml`) — após CI verde em push à `main`, com filtro de paths relevantes (`apps/erp-api/`): roda migrations D1 e deploy via Wrangler. Jobs usam **GitHub Environment `PROD`** para `vars.CLOUDFLARE_API_TOKEN` e `vars.CLOUDFLARE_ACCOUNT_ID`.
- **Web:** deploy da erp-web ainda não automatizado (a definir).

---

## 6. Autenticação e segurança

- **Rotas internas (`/internal/`):** `Authorization: Bearer <ERP_INTERNAL_SECRET>`. Usadas por CDS e sistemas externos para ingestão.
- **Rotas da Web:** NextAuth credentials — valida usuário via CDS JWT com `CDS_JWT_SECRET`.
- **`ERP_INTERNAL_SECRET`:** nunca exposto ao client; usado apenas em server actions/RSC.

---

## 7. Regras críticas

- **Não colocar lógica de negócio em routes.** Routes validam com schema, chamam service, respondem.
- **Não acessar D1 diretamente em routes.** Sempre via `createDb(getEnv(c.env).db)` + repositories.
- **Estoque somente via `stock_movements`.** Nunca alterar `products.current_stock` diretamente.
- **Idempotência em ingestão.** Pedidos externos identificados por `source_system` + `source_external_id` únicos.
- **`cds_consumer_id`** em parties/customers quando houver vínculo com o CDS.

---

## 8. Referência para documentação completa

- **Arquitetura:** [architecture/overview](../architecture/overview.md), [layers](../architecture/layers.md), [folder-structure](../architecture/folder-structure.md), [decisions](../architecture/decisions.md).
- **Domínios:** [domains/](../domains/) (orders, products, inventory, finance, fiscal, purchases, production, parties).
- **Referência:** [reference/routes](../reference/routes.md), [reference/env-vars](../reference/env-vars.md).
- **Índice geral:** [docs/README.md](../README.md).

---

## 9. Regra de atualização deste arquivo

Atualize **project-context.md** sempre que:

- a arquitetura mudar (novas camadas, responsabilidades);
- novos domínios ou rotas surgirem;
- integrações com outros sistemas Tribus mudarem;
- a estrutura de pastas relevante for alterada;
- regras críticas forem modificadas.

Mantenha o texto conciso e alinhado a **docs/** e a **AGENTS.md**.
