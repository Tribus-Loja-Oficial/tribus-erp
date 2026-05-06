# Ingestão estruturada (Tribus ERP)

Contrato espelhado no **tribus-hub**: envelope `version` / `mode` / `objects`, `client_ref` único, `refMap` no resultado, validação semântica de campos `*Ref`, execução ordenada por dependência.

- **API:** `POST /internal/ingestion/validate`, `POST /internal/ingestion/execute`, `POST /internal/ingestion/jobs`, `GET /internal/ingestion/jobs/:id` (Bearer interno, igual a `/internal/orders/ingest`).
- **Web:** apenas **administradores** vêem o botão **Ingestão** no header. O **dry-run** usa `POST /api/admin/ingestion/dry-run`. A **execução** usa `POST /api/admin/ingestion/execute`: payloads **pequenos** continuam **síncronos** (proxy ao Worker até ao resultado); payloads **grandes** são **enfileirados** no Worker (`202` + `jobId`) e o modal faz **polling** em `GET /api/admin/ingestion/jobs/[id]` até `completed` / `failed`. A **validação** continua por server action (rápida). O segredo da API ERP não sai para o browser.

**Limites Vercel:** no plano **Hobby**, o teto prático por Function é ~**60 s** — o `maxDuration` alto na rota **não** remove esse limite no Hobby; usar **`skipProductImageUrls`** e lotes menores quando o sync estiver no limite. No **Pro**, durações maiores são possíveis conforme a documentação Vercel.

## Convenção JSON

- Campos em **`data` usam camelCase** (alinhados aos schemas REST da erp-api), não snake_case do Hub.
- **Excepção (produto):** na ingestão, URLs de imagem usam **`main_image_url`** e **`gallery_image_urls`** (snake_case); ver [ingestion-field-guide.md](./ingestion-field-guide.md).
- Referências cruzadas no mesmo payload: sufixo **`Ref`** (ex.: `productRef`, `categoryRef`) e valor igual ao **`client_ref`** do alvo.
- Se existir **`…Id`** real (UUID) e **`…Ref`**, a execução resolve **`…Ref` primeiro** via `refMap`, depois cai no `…Id` já presente em `data`.

## Produtos simples vs variáveis (`productKind`)

- Em cada objecto **`product`**, `productKind` pode ser **`simple`** (omissão) ou **`variable`**.
- **`product_variant`** no mesmo payload: o **`productRef`** deve ser o `client_ref` de um `product` com **`productKind`: `"variable"`**. Caso contrário, a validação semântica falha com mensagem a pedir `productKind: "variable"` nesse produto.
- **`inventory_movement`** com **`productRef`** a um produto **variable** definido **no mesmo lote**: é obrigatório **`variantId`** (UUID) **ou** **`variantRef`** (igual ao `client_ref` de um `product_variant` nesse payload). A execução resolve `variantRef` → `variantId` via `refMap` depois de criadas as variantes.
- **`order`** — linhas com **`productRef`** a um produto **variable** no lote: mesma regra (**`variantId`** ou **`variantRef`**). `variantRef` aponta para tipo `product_variant`.
- Referências só cruzam objectos **com `client_ref`** no mapa semântico; produtos sem `client_ref` não entram nas regras “in-batch” acima (use IDs reais ou inclua `client_ref` no pai e nas variantes).

## Envelope

| Campo                  | Tipo               | Descrição                                                                                                                                                                                                        |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`              | `"1.0"`            | Literal fixo.                                                                                                                                                                                                    |
| `mode`                 | `"create"`         | Identificador do tipo de payload; reservado para extensão futura.                                                                                                                                                |
| `objects`              | array              | Entre **1** e **50 000** objectos (`INGESTION_MAX_OBJECTS`).                                                                                                                                                     |
| `skipProductImageUrls` | boolean (opcional) | Se **`true`**, ignora `main_image_url` e `gallery_image_urls` em produtos (cria/atualiza sem descarregar URLs). Útil em lotes grandes no **Cloudflare Worker** para evitar pedidos longos (muitos `fetch` + R2). |

### Campos do envelope de cada objecto

| Campo        | Tipo                   | Descrição                                                                                                                 |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `type`       | string (literal)       | Tipo do objecto (ex.: `product`). Obrigatório.                                                                            |
| `action`     | `"skip"` \| `"upsert"` | Comportamento quando o registo já existe. Omitir = `skip`. Ver secção **action** em `ingestion-field-guide.md`.           |
| `client_ref` | string (max 200)       | Identificador local único no payload. Opcional; necessário se outros objectos referenciam este via `*Ref`.                |
| `data`       | object                 | Dados do objecto em camelCase. Schema completo para `skip`; schema de patch (só chave natural obrigatória) para `upsert`. |

## Tipos suportados (`type`)

| `type`                | Descrição breve                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `stock_location`      | Local de armazém (`POST /inventory/locations`).                                                                            |
| `category`            | Categoria de produto.                                                                                                      |
| `collection`          | Coleção.                                                                                                                   |
| `party`               | Party base (sem perfil cliente/fornecedor).                                                                                |
| `customer`            | Party + cliente.                                                                                                           |
| `supplier`            | Party + fornecedor.                                                                                                        |
| `product`             | Produto; `productKind`; `categoryRef` / `collectionRef`; URLs de imagem.                                                   |
| `product_variant`     | Variante; `productRef` → `product` variable; `client_ref` recomendado para `variantRef`.                                   |
| `product_composition` | BOM/embalagem; `parentProductRef`; `childProductRef` ou `childSku`.                                                        |
| `inventory_movement`  | Movimento; `productRef`/`productId`, `locationRef`/`locationId`; `variantRef`/`variantId` se pai variable no lote.         |
| `order`               | Pedido; `customerRef`/`customerId`; itens com `productRef` opcional; `variantRef`/`variantId` se produto variable no lote. |
| `purchase_order`      | OC; `supplierRef`/`supplierId`; linhas com `productRef` opcional.                                                          |

## Ordem de execução (`TYPE_ORDER`)

Os objectos são ordenados antes de executar (independentemente da ordem no JSON):

1. `stock_location`
2. `category`
3. `collection`
4. `party`
5. `customer`
6. `supplier`
7. `product`
8. `product_variant`
9. `product_composition`
10. `inventory_movement`
11. `order`
12. `purchase_order`

## Imagens (produto)

`main_image_url` e `gallery_image_urls`: apenas **HTTPS**; JPEG/PNG/WebP; até 5 MB; timeouts e anti-SSRF básico no Worker. Falha de imagem → **aviso** em `items[].warnings`, produto criado (política A).

### Timeouts, HTTP 500 e ingestão parcial

Cada URL de imagem pode demorar até **15 s** (`FETCH_TIMEOUT_MS`) por tentativa; com muitos produtos e galerias o pedido HTTP ao Worker fica **muito longo** (I/O). O cliente (ex. **Vercel** serverless) ou a infraestrutura pode cortar a ligação antes da resposta → corpo **500** ou erro de rede **mesmo tendo já criado parte dos registos** (a ingestão não é uma única transação).

**Mitigação:**

1. Enviar **`"skipProductImageUrls": true`** no envelope e tratar imagens noutro fluxo (ou segunda ingestão só com URLs em lotes pequenos).
2. Dividir o JSON em várias execuções menores (menos objectos com imagens por pedido).
3. As galerias são processadas com **paralelismo limitado** (5 URLs em simultâneo por produto) para reduzir wall-clock face ao modo estritamente sequencial.

O registo de **auditoria** após a execução falha de forma **isolada**: um erro só no audit não deve impedir a resposta com `items` / `refMap` (evita 500 logo no fim de um lote longo).

## Respostas HTTP

### `POST /internal/ingestion/validate`

- `200` + `{ data: { valid, errors, warnings, summary } }`.
- Erros Zod no envelope → `valid: false` e lista de mensagens (como no Hub).

### `POST /internal/ingestion/dry-run`

Simula a ingestão **sem gravar** na base (apenas leituras para prever ignorados / actualizações em categorias, coleções e produtos com `upsert` ou `skip`).

Corpo:

```json
{
  "dryRun": true,
  "payload": {
    "version": "1.0",
    "mode": "create",
    "objects": []
  }
}
```

Resposta `200` + `{ data: { dryRun: true, valid, errors, warnings, summary, planned, items, refMap } }`:

- `planned`: contagens previstas de `created`, `updated`, `skipped`, `failed` por objecto.
- `items[].plannedStatus`: o mesmo significado que na execução real; `detail` explica falhas previstas.
- `refMap`: mapa previsto de `client_ref` → ID; valores `dry-run:ref:…` / `dry-run:sku:…` são marcadores para registos que **seriam** criados (objectos já existentes usam o ID real).

Se o envelope `dryRun` + `payload` for inválido (Zod), `valid: false` e mensagens em `errors` (sem plano).

### `POST /internal/ingestion/execute`

- `400` + `VALIDATION_ERROR` + `issues` se o payload for inválido após `safeParse` ou validação semântica.
- `200` se nenhuma falha; `207` se criados/actualizados/ignorados + falhas; `422` se tudo falhou.
- Corpo: `{ data: { total, created, updated, skipped, failed, items, refMap } }`.
  - `items[].status`: `"created"` | `"updated"` | `"skipped"` | `"failed"`.

### Modo assíncrono (fila + estado na UI)

Para **um único** fluxo lógico por payload (referências `*Ref` válidas no mesmo lote), cargas grandes não devem partir o JSON em vários `POST /internal/ingestion/execute` sem alterar regras: o Worker grava o payload num job em **D1** (`ingestion_jobs`) e o **consumer** da fila processa os objectos **na ordem de dependência** em **várias invocações curtas** (chunks). Entre invocações o estado (`cursor`, `refMap`, `items` parciais, contagens) fica em **`chunk_state_json`**; após cada chunk o consumer grava o estado, envia **outra mensagem** com o mesmo `jobId` para a fila e faz **`ack`** da mensagem actual — evita `exceededCpu` e evita recomeçar do zero quando a fila reentrega mensagens.

**Tamanho do chunk (Worker):** variável opcional **`INGESTION_QUEUE_CHUNK_SIZE`** (objectos por invocação; por defeito **10**, teto **200** no código). Valores mais baixos usam menos CPU por mensagem; nas continuações o Worker **não** volta a correr Zod/validação semântica completa no payload inteiro (só no 1.º chunk). O `wrangler.toml` define **`[limits] cpu_ms = 30000`** para ambientes Workers Paid; contas com teto muito baixo podem precisar de chunk **1–3** ou de upgrade de plano.

**Idempotência:** se uma invocação falhar **antes** de persistir o estado, a fila pode reprocessar o último chunk; as operações de ingestão devem manter-se **idempotentes** (`upsert` / `skip` por chave natural), como já é desejável para retries genéricos.

**Rotas internas:**

| Rota                               | Descrição                                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/ingestion/jobs`    | Valida o envelope; insere job `queued`; `queue.send({ jobId })`; **`202`** `{ data: { jobId, status: "queued" } }`. Sem binding `INGESTION_QUEUE`: **`503`** `{ code: "QUEUE_UNAVAILABLE", message: … }`. |
| `GET /internal/ingestion/jobs/:id` | **`200`** `{ data: { jobId, status, progress: { processed, total }, result?, error?, updatedAt, startedAt?, finishedAt? } }`.                                                                             |

**Decisão sync vs async (erp-web, servidor):** enfileira se `objects.length` **ou** o tamanho em bytes do JSON serializado exceder limiares. Por defeito: **80** objectos e **512 KiB** (`apps/erp-web/src/lib/ingestion-sync-thresholds.ts`). Sobrescrever com **`INGESTION_SYNC_MAX_OBJECTS`** e **`INGESTION_SYNC_MAX_BODY_BYTES`** (variáveis de ambiente no deploy Vercel).

**Web:** `POST /api/admin/ingestion/execute` devolve `202` no ramo async (header opcional `X-Ingestion-Mode: async`). O cliente consulta `GET /api/admin/ingestion/jobs/[id]` em intervalos (~2 s) até estado terminal; o resultado final replica o `data` da execução síncrona (`items`, contagens, `refMap`).

**Operações:** criar a fila (`tribus-erp-ingestion-queue`), binding no Worker, migração D1 `ingestion_jobs` — ver [deploy.md](../operations/deploy.md).

## Schema JSON e exemplos (contrato para IA)

- **JSON Schema (gerado do Zod):** `apps/erp-web/public/ingestion-payload.schema.json` — exposto no web em `/ingestion-payload.schema.json`. Regeneração: `npm run generate:ingestion-schema` em `apps/erp-api`.
- **Guia de campos / enums / WooCommerce:** [ingestion-field-guide.md](./ingestion-field-guide.md).
- **Exemplos JSON válidos:** `docs/examples/ingestion/*.json` (cada ficheiro é testado contra `ingestionPayloadSchema` na CI).

## Mapeamento rápido (WooCommerce / erros comuns)

| Origem / erro comum                    | Correção no ERP                                   |
| -------------------------------------- | ------------------------------------------------- |
| `productType` = `finished_good`        | `finished_product`                                |
| `status` = `publish`                   | `active`                                          |
| Stock inicial com tipo `initial_stock` | `inventory_movement` com `type`: **`adjustment`** |
| Preço “79.9” em reais                  | `salePriceCents`: **7990** (centavos inteiros)    |

## Ficheiros de referência

- **IA / checklist:** [ingestion-ai-master-template.md](./ingestion-ai-master-template.md)
- **JSON Schema (IDE):** [ingestion-field-guide.md](./ingestion-field-guide.md) + ficheiro gerado em `erp-web/public/`.

## Extensão

Novo domínio: novo literal `type`, ramo no `z.discriminatedUnion`, validação de `*Ref` em `validateIngestionPayload`, handler em `createIngestionObject`, entrada em `INGESTION_TYPE_ORDER` se houver dependência.
