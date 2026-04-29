# Convenções de código — Tribus ERP

---

## Proibido (❌)

- **Lógica de negócio em routes.** Routes apenas validam, delegam e respondem.
- **Acesso direto a `c.env.TRIBUS_ERP_DB`** em routes. Sempre via `createDb(getEnv(c.env).db)`.
- **SQL direto** em services ou routes. Queries apenas em repositories via Drizzle.
- **Alterar `products.currentStock` diretamente.** Sempre via `stock_movements` e inventory service.
- **`console.log` / `console.error`** em vez do logger padronizado.
- **`crypto.randomUUID()` diretamente.** Usar `generateId()` de `src/utils/`.
- **`any` implícito** — TypeScript strict está habilitado.
- **Chamar repositories em routes.** Routes → services → repositories.
- **Expor `ERP_API_INTERNAL_SECRET`** ao client. Apenas em server actions/RSC.
- **Pular validação Zod.** Toda entrada de route deve passar por schema antes de chamar services.

---

## Obrigatório (✅)

- **Camada de services** para toda lógica de negócio e orquestração.
- **Repositories** para toda interação com o banco — sem `db.select().from()` fora de `src/repositories/`.
- **Schemas Zod** para validação de body e query em toda route.
- **Logger padronizado** (`src/observability/logger.ts`) para todos os logs.
- **`generateId()`** para IDs de novas entidades.
- **`AppError` / `NotFoundError` / `BadRequestError`** de `src/errors/` para erros controlados.
- **TypeScript strict:** tratar `noUncheckedIndexedAccess` com variável local ou guard explícito.

```typescript
// Correto com noUncheckedIndexedAccess
const entry = byChannel[channel];
if (!entry) {
  byChannel[channel] = { count: 0 };
}
const e = byChannel[channel]!;
e.count++;
```

---

## Nomenclatura

| Tipo                 | Padrão                            | Exemplo                                |
| -------------------- | --------------------------------- | -------------------------------------- |
| Arquivos API         | `camelCase.ts`                    | `order.service.ts`                     |
| Paths de rota        | `kebab-case`                      | `/purchase-orders`, `/stock-movements` |
| Componentes Web      | `PascalCase.tsx`                  | `OrderTable.tsx`                       |
| Alias Web            | `@/` → `src/`                     | `import { X } from '@/lib/api'`        |
| Tabelas DB           | `snake_case`                      | `stock_movements`                      |
| Colunas DB (Drizzle) | `camelCase`                       | `createdAt`, `unitPriceCents`          |
| Timestamps           | ISO 8601 string                   | `"2026-04-25T14:00:00.000Z"`           |
| Valores monetários   | centavos, inteiro, sufixo `Cents` | `totalCents`, `unitPriceCents`         |

---

## TypeScript

- **Strict habilitado:** `strict: true` + `noUncheckedIndexedAccess: true`.
- **Sem `any` implícito:** tipar sempre ou usar `unknown` com narrowing.
- **Tipos inferidos do Drizzle:** usar `InferSelectModel<typeof table>` em vez de redefinir tipos.
- **Packages compartilhados:** tipos de domínio em `packages/core/src/types.ts`.

---

## Testes (Vitest)

- Testes unitários para services e schemas em `src/__tests__/` de cada app.
- Foco em: services (lógica de negócio), schemas Zod (validação de inputs), utils (helpers críticos).
- Não testar routes diretamente — testar o service que a route chama.
- Mocks de repository: usar `vi.fn()` para isolar o service do banco.
- Coverage mínimo configurado em `vitest.config.ts`.

---

## Imports

- Preferir imports absolutos com alias (`@/`) na Web.
- Na API (Worker), imports relativos são aceitáveis dado o tamanho do projeto.
- Não importar de camadas posteriores (ex.: service não importa de route).

---

## Formatação

- **Prettier** com `semi: true` (ERP usa ponto-e-vírgula).
- **ESLint** configurado em `eslint.config.mjs`.
- Formatação verificada em CI. Rodar `npm run format` antes de commit.
