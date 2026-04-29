# Decisões arquiteturais — Tribus ERP

Registro das principais decisões técnicas e as razões por trás delas.

---

## Cloudflare Workers como runtime da API

**Decisão:** API rodando como Cloudflare Worker, não como servidor Node.js convencional.

**Razões:**

- Zero cold start para sistema interno de baixo volume de requests.
- D1 e R2 nativamente integrados sem configuração de rede.
- Deploy simples via `wrangler deploy` sem gestão de servidores.
- Compatível com o ecossistema já usado pelo CDS.

**Consequência:** sem filesystem local, sem sockets TCP diretos, sem binários nativos. Banco de dados deve ser D1 ou acessível via HTTP.

---

## D1 (SQLite) como banco de dados

**Decisão:** Cloudflare D1 (SQLite distribuído) em vez de PostgreSQL ou MySQL.

**Razões:**

- Integração nativa com Workers sem latência de rede adicional.
- Suficiente para o volume de operações de um ERP interno.
- Migrations gerenciadas via `wrangler d1 migrations apply`.
- Custo zero na camada gratuita para workloads internos.

**Consequência:** sem suporte a operações que dependem de PostgreSQL-específico (arrays, JSON avançado, full-text search nativo). Queries devem usar apenas SQL compatível com SQLite.

---

## Drizzle ORM

**Decisão:** Drizzle em vez de Prisma, Kysely ou SQL direto.

**Razões:**

- Suporte nativo a D1 (Prisma não suportava D1 no momento da decisão).
- TypeScript-first: tipos inferidos do schema, sem geração de código separada.
- Queries type-safe sem abstração excessiva.
- Migrations via `drizzle-kit` com controle explícito dos SQLs.

---

## Hono como framework

**Decisão:** Hono em vez de Express, Fastify ou handlers HTTP puros.

**Razões:**

- Projetado especificamente para edge/workers (sem dependências Node.js).
- API similar ao Express, curva de aprendizado baixa.
- `@hono/zod-validator` integrado para validação de schemas.
- Suporte nativo a Cloudflare Workers sem adapters.

---

## Next.js App Router para o frontend

**Decisão:** Next.js 14 com App Router para `erp-web`.

**Razões:**

- Renderização server-side sem expor secrets ao browser.
- Server Actions permitem chamar a API com `ERP_API_INTERNAL_SECRET` no servidor.
- Consistência com o `tribus-storefront` (mesmo framework).
- Vercel como destino natural de deploy (integração nativa).

---

## Separação API + Web em apps distintos

**Decisão:** `erp-api` e `erp-web` são apps separados no monorepo.

**Razões:**

- Deploy independente: API no Cloudflare Workers, Web na Vercel.
- Escalabilidade separada: API pode ter múltiplas instâncias; Web segue seu próprio ciclo.
- Clareza de responsabilidades: API é a fonte de verdade; Web apenas consome.

---

## Autenticação via CDS JWT

**Decisão:** `erp-web` autentica usuários validando o JWT emitido pelo CDS.

**Razões:**

- Usuários internos já têm conta no CDS (plataforma central de identidade Tribus).
- Evita duplicar gestão de usuários no ERP.
- `CDS_JWT_SECRET` compartilhado permite validação sem chamada HTTP ao CDS.

---

## Estoque somente via `stock_movements`

**Decisão:** `products.current_stock` nunca é alterado diretamente; toda variação passa por um registro em `stock_movements`.

**Razões:**

- Auditabilidade completa: todo movimento tem tipo, referência, data e usuário.
- Rollback possível: reprocessar movimentos reconstrói o estoque.
- Rastreamento por local: cada movement tem `locationId`.

---

## Idempotência em ingestão

**Decisão:** `POST /internal/orders/ingest` é idempotente por `source_system` + `source_external_id`.

**Razões:**

- CDS pode reenviar o mesmo pedido em caso de falha de rede.
- Garante que um pedido nunca seja duplicado mesmo com retentativas.
- Padrão seguro para integrações entre sistemas.

---

## Valores monetários em centavos

**Decisão:** todos os campos monetários armazenam inteiros em centavos, com sufixo `Cents` (ex.: `totalCents`, `unitPriceCents`).

**Razões:**

- Elimina erros de arredondamento de ponto flutuante.
- Padrão consistente com o CDS e storefront.
- Inteiros são seguros em SQLite e JSON.
