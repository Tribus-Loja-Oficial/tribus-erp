# Monitoramento — Tribus ERP

---

## Logs

### Logger padronizado

O ERP usa o logger em `apps/erp-api/src/observability/logger.ts`. Todos os logs devem passar por ele — nunca usar `console.log` diretamente.

```typescript
import { logger } from "../observability/logger";

logger.info("Order created", { orderId, customerId });
logger.error("Failed to insert BOM", { error });
```

### Request ID

Cada request recebe um `X-Request-Id` único gerado pelo middleware em `src/observability/request-id.ts`. O ID aparece nos logs e na resposta HTTP para rastreabilidade.

### Cloudflare Observability

Logs e traces ficam disponíveis no dashboard Cloudflare em:

- **Workers → tribus-erp-api → Logs** (tail logs em tempo real via `wrangler tail`)
- **Workers → Analytics** (throughput, latência, erros)

Para ver logs em tempo real:

```bash
npx wrangler tail
```

---

## Coverage de testes

O CI publica um snapshot de coverage no **tribus-monitor** a cada push para `main` ou `development`.

Script: `scripts/publish-coverage.mjs`

O snapshot contém:

- `totalLines`, `coveredLines`, `lineRate`
- `totalStatements`, `coveredStatements`, `statementRate`
- `totalBranches`, `coveredBranches`, `branchRate`
- `totalFunctions`, `coveredFunctions`, `functionRate`

Variáveis necessárias no GitHub Environment `PROD`:

- `MONITOR_API_URL` — URL do tribus-monitor
- `MONITOR_COVERAGE_TOKEN` — token de autenticação

---

## Health check

```
GET /health
```

Retorna:

```json
{
  "status": "ok",
  "timestamp": "2026-04-25T14:00:00.000Z"
}
```

Não requer autenticação. Usado para verificação de deploy e uptime externo.

---

## Erros e alertas

- Erros HTTP 5xx são logados com stack trace via logger.
- Cloudflare Analytics exibe a taxa de erros por rota.
- `wrangler tail --format=pretty` para debug em tempo real durante deploy.
