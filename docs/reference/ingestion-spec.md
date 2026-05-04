# Ingestão estruturada (ERP API)

Contrato alinhado ao **tribus-hub** (envelope `version` / `mode` / `objects`, `client_ref`, `refMap`). A execução e validação semântica residem na **erp-api** (`POST /internal/ingestion/validate` e `POST /internal/ingestion/execute`) com `Authorization: Bearer` igual ao resto das rotas internas. O **erp-web** chama estas rotas apenas em **server actions** (o segredo nunca vai ao browser).

## Envelope

| Campo     | Tipo       | Descrição                                |
| --------- | ---------- | ---------------------------------------- |
| `version` | `"1.0"`    | Versão do contrato.                      |
| `mode`    | `"create"` | Modo actual; apenas criação.             |
| `objects` | array      | 1–100 objectos discriminados por `type`. |

## Objectos

Cada entrada:

- `type`: literal do domínio (v1: `"product"`).
- `client_ref` (opcional): identificador estável no payload; após sucesso aparece em `refMap` → ID criado.
- `data`: campos específicos do tipo.

### `type: "product"`

Corresponde ao corpo de criação de produto (`createProduct` na API), em **camelCase**, mais campos opcionais de imagem por URL:

| Campo extra          | Descrição                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `main_image_url`     | HTTPS público; JPEG/PNG/WebP; aplicado após o create (política A: falha → aviso, produto criado). |
| `gallery_image_urls` | Lista de URLs com as mesmas regras; ficheiros são anexados à galeria.                             |

Os URLs são descarregados no Worker com limite de tamanho (5 MB), timeout, redirecionamentos limitados e bloqueio básico de SSRF (sem `http:`, sem redes privadas em hostname).

## Respostas

### `POST /internal/ingestion/validate`

- Corpo: envelope JSON.
- `200` com `{ data: { valid, errors, warnings, summary } }` (erros de schema Zod devolvem `valid: false` com mensagens agregadas, como no Hub).

### `POST /internal/ingestion/execute`

- Exige payload semanticamente válido; caso contrário `400` com `code: "VALIDATION_ERROR"` e `issues`.
- `200`: todos os objectos criados.
- `207`: criação parcial (`failed > 0` e `created > 0`).
- `422`: nenhum criado (`created === 0` e `failed > 0`).
- Corpo: `{ data: { total, created, failed, items, refMap } }`, onde `items[].warnings` pode listar falhas de imagem sem falhar o produto.

## Exemplo mínimo

```json
{
  "version": "1.0",
  "mode": "create",
  "objects": [
    {
      "type": "product",
      "client_ref": "meu_produto",
      "data": {
        "sku": "SKU-INGEST-001",
        "name": "Nome do produto",
        "productType": "finished_product",
        "salePriceCents": 2500,
        "costPriceCents": 1000,
        "main_image_url": "https://cdn.exemplo.com/foto.jpg"
      }
    }
  ]
}
```

## Extensão

Novos tipos: acrescentar literal em `ingestionObjectSchema`, ramo no handler, e `TYPE_ORDER` quando existirem dependências entre tipos.
