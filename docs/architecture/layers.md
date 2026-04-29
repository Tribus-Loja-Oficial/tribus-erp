# Camadas da arquitetura — Tribus ERP

## API (`apps/erp-api`) — Cloudflare Worker + Hono

Ordem estrita de dependência:

```
config → db / storage → schemas → repositories → services → routes
```

Nenhuma camada pode importar de uma camada posterior. Routes não chamam repositories; services não leem `c.env` diretamente.

---

### Config (`src/config/env.ts`)

- Lê e valida as variáveis de ambiente do Worker via `c.env` usando Zod.
- Exporta `getEnv(env)` → retorna `AppConfig` tipado.
- É a **única** camada que conhece os nomes brutos das env vars.

```typescript
const config = getEnv(c.env);
const db = createDb(config.db);
```

---

### DB (`src/db/`)

| Subdiretório      | Conteúdo                                          |
| ----------------- | ------------------------------------------------- |
| `schema/index.ts` | Definições Drizzle de todas as tabelas            |
| `client.ts`       | `createDb(d1: D1Database)` — cria cliente Drizzle |
| `migrations/`     | Arquivos SQL de migração                          |

- O cliente D1 é instanciado por request, nunca global.
- Migrations rodadas via `wrangler d1 migrations apply` no deploy.

---

### Storage (`src/storage/`)

- Acesso ao R2 para armazenamento de documentos fiscais (XMLs de NF-e).
- Isolado em provider próprio; services chamam funções de storage, não o binding R2 diretamente.

---

### Schemas (`src/schemas/`)

- Schemas Zod para validação de inputs de rotas (body, query params, path params).
- Um arquivo por domínio: `orders.ts`, `inventory.ts`, `finance.ts`, etc.
- Routes usam `@hono/zod-validator` para aplicar os schemas.
- **Nunca** contêm lógica de negócio — apenas shape e validação de dados.

---

### Repositories (`src/repositories/`)

- **Único** ponto de acesso ao banco via Drizzle.
- Um arquivo por domínio/entidade.
- Funções puras: recebem `db` + parâmetros, retornam dados.
- **Sem** lógica de negócio: sem cálculos, sem decisões de fluxo.

```typescript
// Correto: repository só faz query
async function findOrderById(db: DB, id: string) {
  return db.query.orders.findFirst({ where: eq(orders.id, id) });
}
```

---

### Services (`src/services/`)

- **Toda** a lógica de negócio fica aqui.
- Orquestram repositories, calculam totais, aplicam regras, geram IDs.
- Chamam outros services quando necessário (ex.: inventory service ao receber compra).
- Lançam `AppError` / `NotFoundError` / `BadRequestError` em casos de erro.

```typescript
// Correto: service orquestra
async function createOrder(db: DB, data: CreateOrderInput) {
  const id = generateId();
  const total = data.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  await orderRepo.insert(db, { id, ...data, totalCents: total });
  await customerRepo.updateStats(db, data.customerId, total);
}
```

---

### Routes (`src/routes/`)

- Recebem a request HTTP via Hono.
- Validam body/query com schema Zod.
- Instanciam config, db e service.
- Chamam **um** método de service.
- Respondem com JSON.
- **Não** contêm lógica de negócio.

```typescript
app.get("/", zValidator("query", listOrdersSchema), async (c) => {
  const parsed = c.req.valid("query");
  const config = getEnv(c.env);
  const db = createDb(config.db);
  const service = createOrderService(db);
  const result = await service.findMany(parsed);
  return c.json(result);
});
```

---

## Web (`apps/erp-web`) — Next.js App Router

| Camada                  | Onde                    | Responsabilidade                                          |
| ----------------------- | ----------------------- | --------------------------------------------------------- |
| Server Actions          | `src/server/`           | Chamam API com `ERP_API_INTERNAL_SECRET`.                 |
| RSC (Server Components) | `app/(dashboard)/`      | Renderização server-side; nunca expõem secrets ao client. |
| Client Components       | `app/` + `components/`  | UI interativa; não conhecem secrets.                      |
| API Client              | `src/lib/api/`          | `erpApiFetch` — HTTP client autenticado para a erp-api.   |
| Auth                    | `src/lib/auth/`         | NextAuth credentials; valida via CDS JWT.                 |
| Config                  | `src/lib/config/env.ts` | Lê env vars do Next.js server.                            |

**Regra crítica:** `ERP_API_INTERNAL_SECRET` nunca é enviado ao browser. Apenas Server Actions e RSC o usam.

---

## Packages (`packages/core`)

- `types.ts` — 67+ tipos TypeScript compartilhados entre API e Web.
- `schemas.ts` — schemas Zod reutilizáveis (ex.: paginação, IDs).

Importado como `@tribus/core` em ambos os apps.
