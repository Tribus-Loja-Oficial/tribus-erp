# Guia obrigatório para IA — Tribus ERP

Este arquivo é o **contrato de trabalho** e o **guia obrigatório** que toda IA (Cursor, Claude, etc.) deve seguir antes e durante qualquer implementação no repositório **tribus-erp**.

---

## 1. Contexto do projeto (resumo)

- **O que é o tribus-erp:** sistema interno de gestão operacional, comercial, financeira e fiscal da Tribus. Monorepo com API (Cloudflare Workers + Hono + Drizzle + D1 + R2) e Web (Next.js App Router).
- **Papel na plataforma Tribus:** backend interno que centraliza pedidos, estoque, financeiro, fiscal, produção e compras. Recebe ingestão de pedidos do CDS e de outros sistemas via rotas internas autenticadas com `ERP_INTERNAL_SECRET`.
- **Autenticação:** a Web usa NextAuth (credentials MVP) validando via CDS JWT. A API expõe rotas internas protegidas por Bearer token.

---

## 2. Leitura obrigatória antes de qualquer tarefa

A IA **deve sempre** ler, nesta ordem:

1. **docs/ai-context/project-context.md** — contexto canônico do projeto.
2. **docs/ai-context/development-rules.md** — regras de desenvolvimento e documentação.
3. **docs/README.md** — índice da documentação e navegação por objetivo.

Além disso, ler **toda a documentação relevante ao domínio da tarefa**:

- **Domínios afetados:** `docs/domains/*` (orders, products, inventory, finance, fiscal, purchases, production, parties).
- **Arquitetura:** `docs/architecture/*` (overview, layers, folder-structure, decisions).
- **Referência:** `docs/reference/routes.md`, `docs/reference/env-vars.md` quando a tarefa envolver rotas ou variáveis de ambiente.
- **Convenções:** `docs/conventions/code.md`, `docs/conventions/security.md`.

---

## 3. Regras obrigatórias de desenvolvimento

- **Respeitar a arquitetura existente.** Não criar atalhos fora das camadas.
- **Separação estrita (API):**
  `config` → `db / storage` → `schemas (Zod)` → `repositories` → `services` → `routes`
- **Separação estrita (Web):**
  Lógica de negócio somente no servidor (server actions ou RSC). O client nunca expõe `ERP_API_INTERNAL_SECRET` nem chama a API diretamente com o secret.
- **Não usar `c.env.TRIBUS_ERP_DB` ou SQL direto em `routes/`** — sempre via `createDb` + repositories + services.
- **Validar todos os inputs com Zod.** Toda rota que recebe body ou query deve usar um schema em `src/schemas/` antes de chamar services.
- **Estoque somente via `stock_movements`.** Nunca alterar `products.current_stock` diretamente.

Detalhes completos: **docs/conventions/code.md** e **docs/conventions/security.md**.

---

## 4. Regra obrigatória de documentação

A IA **deve**:

- **Sempre** verificar se a mudança no código impacta a documentação.
- **Atualizar automaticamente** os documentos afetados em:
  - `docs/domains/*`
  - `docs/reference/*` (routes.md, env-vars.md)
  - `docs/architecture/*`
  - `docs/getting-started/*`
  - `docs/operations/*`
- **Se nenhuma documentação precisar ser alterada,** explicar **explicitamente** por quê na entrega (ex.: "Nenhuma doc alterada: apenas refatoração interna sem nova rota, env ou fluxo.").

---

## 5. Regra de atualização dos arquivos de contexto para IA

**Crítico:** a IA deve **manter atualizados** os arquivos de contexto para IA sempre que:

- a arquitetura mudar (novas camadas, mudança de responsabilidades);
- novos domínios ou rotas forem criados;
- novas convenções ou regras de desenvolvimento forem adotadas;
- integrações com outros sistemas Tribus mudarem.

Arquivos a manter atualizados:

- **docs/ai-context/project-context.md** — visão geral, camadas, pastas, domínios, integrações, regras críticas.
- **docs/ai-context/development-rules.md** — regras de arquitetura, documentação, implementação, análise antes de codar e entrega.

Quando não houver mudança nesses arquivos, indicar na entrega: "Contexto IA: nenhuma alteração (motivo: …)."

---

## 6. Checklist obrigatório de entrega

Toda resposta da IA ao concluir uma tarefa **deve** terminar com:

1. **Arquivos de código alterados** — lista dos arquivos modificados ou criados no código-fonte.
2. **Arquivos de documentação alterados** — lista dos arquivos em `docs/` atualizados (ou justificativa explícita de por que nenhum foi alterado).
3. **Arquivos de contexto IA atualizados** — `project-context.md` e/ou `development-rules.md` se aplicável (ou declaração de que não foi necessário).
4. **Explicação de impactos** — resumo do impacto na arquitetura, em domínios existentes e em convenções (se houver).

---

## Princípios gerais do sistema

- **Documentação é parte do código.** Toda mudança relevante no código deve refletir na documentação.
- **Contexto IA é canônico.** Os arquivos em `docs/ai-context/` devem estar sempre alinhados ao estado atual do projeto.
- **AGENTS.md é obrigatório.** Deve ser lido antes de qualquer tarefa.
- **Nada de "quick hacks".** Toda implementação deve respeitar a arquitetura e as convenções.
- **Atualização contínua.** Documentação e contexto para IA evoluem junto com o projeto.

Para o template padrão de tarefas, use **docs/ai-context/task-template.md**.
