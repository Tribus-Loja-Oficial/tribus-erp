# R2, chaves de objeto e `document_files`

Este documento fixa a **convenção de prefixos** no bucket Cloudflare R2, o papel da tabela **`document_files`** em D1 e as **decisões** para mídia de produto (antes e depois do upload na UI).

## Bucket

- **Um bucket** por ambiente (ex.: `tribus-erp-documents`, binding `TRIBUS_ERP_R2` em `apps/erp-api/wrangler.toml`).
- A separação por tipo de ficheiro faz-se pela **chave completa** (`storage_key`), não por buckets adicionais, salvo requisito futuro (compliance, faturação, isolamento legal).

## Prefixos por domínio (chaves R2)

Prefixos em minúsculas, sem espaços, estáveis no tempo:

| Domínio                                      | Prefixo (padrão)              | Exemplo                                                                                      |
| -------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Fiscal NF-e                                  | `fiscal/nfe/{YYYY-MM}/`       | `fiscal/nfe/2026-01/35210123456789012345678901234567890123456.xml` (ver `fiscal.service.ts`) |
| Mídia de produto (rascunho, sem `productId`) | `products/draft/`             | `products/draft/{32hex}.jpg`                                                                 |
| Mídia de produto (ligada a produto)          | `products/{productId}/media/` | `products/prd_xxx/media/{32hex}.webp`                                                        |
| Futuros (ex.: anexos de compras)             | `purchases/…`, `production/…` | Mesmo espírito: prefixo por domínio + identificador estável                                  |

**Nome do objeto:** segmento final com **32 caracteres hexadecimais** (mesmo núcleo que o sufixo do `id` em `document_files`, ver abaixo) + **extensão** inferida do MIME (`.jpg`, `.png`, `.webp`), para evitar colisões e facilitar limpeza.

## Tabela `document_files`

- **`storage_key`:** chave completa no R2 (única); fonte de verdade para localização do objeto.
- **`id`:** identificador exposto à aplicação e persistido no produto (ver decisão abaixo).
- **`mime_type`**, **`filename`**, **`size_bytes`**, **`created_at`:** metadados operacionais.
- **`reference_type`** / **`reference_id`:** vínculo lógico ao domínio (produto, rascunho, etc.).

### Valores de `reference_type` (mídia de produto e rascunho)

| `reference_type`  | `reference_id` | Quando usar                                                                                                                                                                                                                                                |
| ----------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product_image`   | `product_id`   | Upload com produto já criado; chave sob `products/{productId}/media/…`. Serve imagem principal e galeria: a distinção é **qual campo do produto** guarda o `id` (`mainImageFileId` vs entrada em `imagesJson`), não uma segunda linha de tipo obrigatória. |
| `product_draft`   | `NULL`         | Upload **antes** de existir produto; chave sob `products/draft/…`. O utilizador copia o `id` para o formulário até gravar o produto; limpeza de órfãos pode ser política futura.                                                                           |
| `product_gallery` | _(reservado)_  | Opcional futuro se for necessário lifecycle ou relatórios só para galeria.                                                                                                                                                                                 |

Outros domínios (fiscal, etc.) podem usar `reference_type` próprio quando passarem a registar linhas em `document_files`.

## Decisões — produto e formulário

1. **O produto guarda o `document_files.id`**, não a `storage_key`. O UI e a API de produto continuam a trabalhar com identificadores do tipo `file_<32hex>` (placeholder já usado no formulário operacional).
2. **Chave R2:** com `productId` conhecido → `products/{productId}/media/{hex}.{ext}`; sem produto → `products/draft/{hex}.{ext}`.
3. **Uma fonte de verdade:** o binário está no R2; a linha em `document_files` é o registo canónico; o produto referencia só o `id`.
4. **Público vs privado:** imagens de vitrine podem mais tarde expor URL assinada ou Worker/CDN; ficheiros sensíveis mantêm-se só atrás de rotas autenticadas. Sub-árvore `products/public/…` fica como evolução opcional se políticas divergirem.
5. **Limites na API de upload:** JPEG/PNG/WebP; tamanho máximo **5 MB** (validado antes do `put`).

## Implementação de referência

- **Upload:** `POST /products/media/upload` (multipart, campo `file`; opcional `productId`), com `Authorization: Bearer` igual às outras chamadas erp-web → erp-api (`ERP_INTERNAL_SECRET` / `ERP_API_INTERNAL_SECRET` alinhados).
- **Serviço:** `createProductMediaService` + `R2StorageProvider.putObject`.
- **UI:** separador Mídia em `product-operational-form.tsx` — envio via server action que reencaminha o `FormData` para a rota acima.

## Referência cruzada

- Padrão fiscal: `apps/erp-api/src/services/fiscal.service.ts`.
- Provider R2: `apps/erp-api/src/storage/r2-storage-provider.ts`.
- Schema: `document_files` em `apps/erp-api/src/db/schema/index.ts`.
