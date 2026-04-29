# Convenções de segurança — Tribus ERP

---

## Secrets e variáveis de ambiente

- **Nunca commitar valores de secrets** em arquivos versionados. Usar `.dev.vars` (gitignored) para desenvolvimento local.
- **Todos os segredos são variáveis de ambiente** (vars, não secrets Cloudflare) para facilitar visibilidade e manutenção.
- Valores de produção configurados no **GitHub Environment `PROD`** para CI/CD e no **dashboard Cloudflare** para o Worker.

---

## `ERP_INTERNAL_SECRET`

- Autentica chamadas de sistemas externos (CDS) para rotas `/internal/*`.
- Nunca exposto ao browser ou ao client Next.js.
- Validado no middleware de autenticação das rotas internas:
  ```
  Authorization: Bearer <ERP_INTERNAL_SECRET>
  ```
- Em caso de token inválido ou ausente: resposta `401 Unauthorized`.

---

## `CDS_JWT_SECRET`

- Usado pelo `erp-api` para validar tokens JWT emitidos pelo CDS.
- Deve ser idêntico ao `JWT_SECRET` do CDS (`tribus-cds`).
- Nunca exposto ao client.

---

## `ERP_API_INTERNAL_SECRET` (Web → API)

- Usado pela `erp-web` para autenticar chamadas à `erp-api` via `erpApiFetch`.
- Configurado exclusivamente no servidor (Next.js server actions e RSC).
- **Nunca** incluído em Client Components, props de client, ou requests do browser.

---

## Autenticação de usuários (erp-web)

- **NextAuth credentials**: valida e-mail/senha do usuário contra o CDS.
- O CDS emite um JWT assinado com `CDS_JWT_SECRET`.
- O `erp-web` valida esse JWT localmente (sem chamada HTTP ao CDS por request).
- Sessão gerenciada pelo NextAuth com JWE (criptografia do token de sessão).
- `NEXTAUTH_SECRET` (ou `AUTH_SECRET`) para cifrar a sessão — nunca exposto ao client.

---

## Rotas públicas

Apenas `/health` responde sem autenticação. Todas as outras rotas requerem:

- JWT de usuário (erp-web → erp-api via `ERP_API_INTERNAL_SECRET`), **ou**
- Bearer token (`ERP_INTERNAL_SECRET`) para rotas `/internal/*`.

---

## CORS

CORS configurado no middleware do Hono. Apenas origens permitidas recebem respostas (configurado em `src/index.ts`).

---

## Princípios gerais

- **Princípio do menor privilégio:** cada sistema conhece apenas os secrets que precisa.
- **Rotação de secrets:** ao rotacionar, atualizar simultaneamente nos dois sistemas que compartilham o valor (ex.: `CDS_JWT_SECRET` no CDS e no ERP).
- **Auditoria:** alterações sensíveis (status de pedido, movimentos financeiros) são registradas em `audit_logs` com o ID do usuário.
- **Sem SQL injection:** Drizzle usa prepared statements; nunca construir queries com concatenação de strings.
