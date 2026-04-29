# Domínio: Fiscal — Tribus ERP

Gerencia documentos fiscais eletrônicos (NF-e, NFC-e, NFS-e). Suporta importação via XML e armazenamento dos arquivos no R2.

---

## Modelo de dados

### `fiscal_documents`

| Campo               | Tipo        | Descrição                                         |
| ------------------- | ----------- | ------------------------------------------------- |
| `id`                | text PK     |                                                   |
| `type`              | enum        | `nfe`, `nfce`, `nfse`                             |
| `accessKey`         | text unique | Chave de acesso (44 dígitos)                      |
| `number`            | text        | Número da nota                                    |
| `series`            | text        | Série da nota                                     |
| `issuerName`        | text        | Razão social do emitente                          |
| `issuerDocument`    | text        | CNPJ do emitente                                  |
| `recipientName`     | text?       | Razão social do destinatário                      |
| `recipientDocument` | text?       | CPF/CNPJ do destinatário                          |
| `partyId`           | text FK?    | Referência a `parties.id` (emitente/destinatário) |
| `totalCents`        | integer     | Valor total da nota em centavos                   |
| `taxCents`          | integer     | Impostos totais em centavos                       |
| `issuedAt`          | text        | Data de emissão (ISO 8601)                        |
| `r2Key`             | text?       | Chave do arquivo XML no R2                        |
| `status`            | enum        | `active`, `cancelled`                             |
| `createdAt`         | text        | ISO 8601                                          |

### `fiscal_document_items`

| Campo            | Tipo     | Descrição                           |
| ---------------- | -------- | ----------------------------------- |
| `id`             | text PK  |                                     |
| `documentId`     | text FK  |                                     |
| `productId`      | text FK? | Produto correspondente (se mapeado) |
| `description`    | text     | Descrição do item na nota           |
| `ncm`            | text?    | NCM (código fiscal)                 |
| `cfop`           | text?    | CFOP da operação                    |
| `quantity`       | real     |                                     |
| `unit`           | text     | Unidade de medida                   |
| `unitPriceCents` | integer  |                                     |
| `totalCents`     | integer  |                                     |
| `taxCents`       | integer? |                                     |

---

## Rotas

| Método | Path                          | Auth   | Descrição                                     |
| ------ | ----------------------------- | ------ | --------------------------------------------- |
| `GET`  | `/fiscal`                     | JWT    | Lista documentos fiscais (filtros, paginação) |
| `POST` | `/fiscal/xml/import`          | JWT    | Importa NF-e via XML                          |
| `GET`  | `/fiscal/:id`                 | JWT    | Retorna documento com itens                   |
| `POST` | `/internal/fiscal/xml/import` | Bearer | Importação interna autenticada                |

---

## Fluxo de importação de XML

```
1. Cliente envia o XML da NF-e via POST /fiscal/xml/import
2. FiscalService.importXml()
   a. Verifica se accessKey já existe → retorna existente (idempotente)
   b. Parse leve do XML (regex, sem DOM)
   c. Cria ou localiza a party do emitente/destinatário
   d. Salva fiscal_document e fiscal_document_items no D1
   e. Armazena o XML bruto no R2 (chave: fiscal/{accessKey}.xml)
3. Retorna o documento criado
```

---

## Regras de negócio

- **Idempotência por `accessKey`**: reimportar uma NF-e com a mesma chave de acesso retorna o documento existente sem criar duplicata.
- **Parse via regex**: para evitar dependências pesadas de XML parser em Workers, o parser usa expressões regulares leves. Campos complexos (ex.: tributos detalhados) podem não ser extraídos completamente.
- **XML no R2**: o arquivo original é sempre armazenado no R2 para consulta futura e conformidade fiscal.
- **Vínculo com party**: se o CNPJ do emitente/destinatário corresponder a uma party existente, `partyId` é preenchido automaticamente.

---

## Service

`src/services/fiscal.service.ts` — `createFiscalService(db, r2)`

Métodos: `importXml`, `findMany`, `findById`.

O service recebe o binding R2 além do banco, pois precisa armazenar os XMLs.
