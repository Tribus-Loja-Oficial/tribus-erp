# Regras de desenvolvimento para IA — Tribus ERP

Este arquivo define **como a IA deve trabalhar** dentro do projeto tribus-erp. Deve ser atualizado quando novas regras ou padrões forem definidos.

---

## 1. Regras de arquitetura

### ❌ Proibido

- Colocar **lógica de negócio** em routes. Routes apenas validam, delegam para services e respondem.
- **Acesso direto ao D1** (`c.env.TRIBUS_ERP_DB`) em routes. Sempre via `createDb(getEnv(c.env).db)` + repositories.
- **SQL direto** em services ou routes. Queries apenas em repositories via Drizzle.
- **Alterar `products.current_stock` diretamente.** Sempre via `stock_movements` e o serviço de inventário.
- **Expor `ERP_API_INTERNAL_SECRET`** ao client. Apenas em server actions/RSC no servidor.
- **Pular validação com schema.** Toda entrada de route (body, query) deve passar por Zod em `src/schemas/` antes de chamar services.
- **Chamar repositories diretamente em routes.** Routes chamam services; services chamam repositories.

### ✅ Obrigatório

- **Usar a camada de services** para orquestração e regras de negócio. Cada domínio tem service em `src/services/`.
- **Usar repositories** para toda interação com o banco. Não usar `db.select().from(...)` fora de `src/repositories/`.
- **Validar entrada com schemas Zod** em toda route que recebe body ou query. Reutilizar ou definir schemas em `src/schemas/`.
- **Manter separação de responsabilidades:** routes → validação + delegação; services → lógica + repositories; repositories → queries Drizzle.
- **Usar o logger padronizado** (`src/observability/logger.ts`) em vez de `console.log`/`console.error`.
- **Usar `generateId()`** para gerar IDs de novas entidades (não `crypto.randomUUID()` diretamente).
- **Idempotência em ingestão:** verificar `source_system` + `source_external_id` antes de criar pedidos externos.

---

## 2. Regras de documentação

A IA **deve**:

- **Atualizar a documentação** sempre que a mudança no código a impactar.
- Atualizar, conforme o caso:
  - **reference/routes.md** — novas rotas ou mudança de contrato (método, path, auth, service, erros).
  - **reference/env-vars.md** — novas variáveis ou mudança de obrigatoriedade/escopo.
  - **docs/domains/** — quando o domínio ganhar ou perder responsabilidades, rotas ou regras.
  - **docs/architecture/** — quando a estrutura de pastas ou as camadas mudarem.
  - **docs/getting-started/**, **docs/operations/** — quando houver impacto em setup ou operação.
- **Explicar quando não atualizou:** se nenhum arquivo de documentação for alterado, justificar explicitamente na entrega.

---

## 3. Regras de implementação

- Código **limpo e consistente** com o restante do projeto (nomenclatura, imports, TypeScript strict).
- **Reutilizar** funções e repositories existentes. Não duplicar lógica já presente.
- **Não quebrar** comportamento existente sem justificativa explícita.
- **Manter o padrão do projeto:**
  - API: arquivos em `camelCase.ts`; rotas em `kebab-case` no path.
  - Web: alias `@/` para `src/`; componentes em PascalCase.
  - Timestamps: `createdAt`, `updatedAt`, `archivedAt` como ISO strings.
  - Valores monetários: centavos (inteiros), sufixo `Cents`.
- **TypeScript strict:** sem `any` implícito; tratar `noUncheckedIndexedAccess` com variáveis locais ou guards explícitos.

---

## 4. Regra de análise antes de codar

Antes de implementar, a IA **deve**:

- **Ler a documentação relevante** ao domínio afetado (domains, architecture, reference).
- **Entender as tabelas envolvidas** (schema Drizzle em `src/db/schema/`) e os repositories existentes.
- **Identificar as camadas envolvidas** (config, db, schemas, repositories, services, routes) e onde a mudança será feita.
- Consultar **AGENTS.md** e **docs/ai-context/project-context.md** para garantir alinhamento com o contexto canônico.

---

## 5. Regra de entrega

Toda entrega **deve** incluir:

- **O que foi feito** — resumo objetivo da tarefa e da solução.
- **Arquivos alterados** — lista de arquivos de código e de documentação modificados ou criados.
- **Impacto na arquitetura** — se houve nova rota, novo service, nova tabela, nova env ou mudança de domínio; caso contrário, afirmar que não houve impacto arquitetural relevante.
- **Documentação atualizada** — quais documentos em `docs/` foram atualizados (ou justificativa de por que nenhum).
- **Contexto IA atualizado** — se `project-context.md` e/ou `development-rules.md` foram atualizados (ou declaração de que não foi necessário).

---

## 6. Regra de atualização deste próprio arquivo

Atualize **development-rules.md** quando:

- **Novas regras** de arquitetura, documentação ou implementação forem adotadas.
- **Novos padrões** do projeto forem definidos (nomenclatura, estrutura, convenções).
- Houver mudança na **regra de entrega** ou na **regra de análise antes de codar**.

Mantenha o texto em PT-BR, técnico e alinhado a **docs/conventions/** e a **AGENTS.md**.
