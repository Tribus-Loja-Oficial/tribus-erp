# Guia de campos — Ingestão Tribus ERP

Contrato formal: **`apps/erp-api/src/schemas/ingestion.schemas.ts`** (Zod) + validação semântica em `validateIngestionPayload`.

## Fonte de verdade e JSON Schema

- O ficheiro **`apps/erp-web/public/ingestion-payload.schema.json`** é **gerado** a partir de `ingestionPayloadSchema` com `zod-to-json-schema` (sem divergência de enums/required face ao backend).
- Regenerar após alterações ao Zod:

```bash
cd apps/erp-api && npm run generate:ingestion-schema
```

## Campo `action` (envelope, por objecto)

Campo opcional no envelope de cada objecto (ao lado de `type` e `client_ref`). Controla o comportamento quando o registo já existe na base de dados.

| Valor    | Comportamento                                                                                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skip`   | **(default)** Insere se não existe; ignora (resolve refs) se já existe. Seguro para re-ingestão.                                                                                         |
| `upsert` | Se o registo existir: actualiza **apenas os campos enviados** (merge-patch — campos omitidos ficam intocados). Se não existir: cria (campos obrigatórios do tipo devem estar presentes). |

**Chave natural por tipo (identifica o registo a actualizar):**

| Tipo         | Chave natural obrigatória em `data` |
| ------------ | ----------------------------------- |
| `category`   | `slug`                              |
| `collection` | `slug`                              |
| `product`    | `slug` **ou** `sku` (pelo menos um) |

**Tipos sem suporte a upsert** (`stock_location`, `party`, `customer`, `supplier`, `product_variant`, `product_composition`, `inventory_movement`, `order`, `purchase_order`): o campo `action` é aceite pela validação mas ignorado em execução (comporta-se como `skip`).

**Resultado no campo `status` de cada item:**

| Status    | Significado                                            |
| --------- | ------------------------------------------------------ |
| `created` | Novo registo inserido.                                 |
| `updated` | Registo existente actualizado via upsert.              |
| `skipped` | Registo já existia; ignorado (action skip ou omitido). |
| `failed`  | Erro — ver campo `error`.                              |

**Exemplo mínimo — actualizar só a descrição de uma categoria:**

```json
{
  "version": "1.0",
  "mode": "create",
  "objects": [
    {
      "type": "category",
      "action": "upsert",
      "client_ref": "CAT-PULSEIRAS",
      "data": {
        "slug": "pulseiras",
        "description": "Nova descrição da categoria Pulseiras."
      }
    }
  ]
}
```

**Exemplo — actualizar preço de venda de um produto:**

```json
{
  "type": "product",
  "action": "upsert",
  "data": {
    "slug": "pulseira-impulso-g",
    "salePriceCents": 8990
  }
}
```

## CamelCase e excepções

- Quase todos os campos em `data` seguem **camelCase** como na REST API (`salePriceCents`, `categoryRef`, …).
- **Únicas excepções na ingestão de produto** (campos extra da camada de ingestão): **`main_image_url`**, **`gallery_image_urls`** — continuam em **snake_case** por alinhamento histórico com o pipeline de URLs; não existem `mainImageUrl` / `galleryImageUrls` no validador.

## Dinheiro

Todos os valores monetários são **inteiros em centavos** (evitar floats):

| Campo típico            | Exemplo                         | Significado |
| ----------------------- | ------------------------------- | ----------- |
| `salePriceCents`        | `7990`                          | R$ 79,90    |
| `costPriceCents`        | `3500`                          | R$ 35,00    |
| `compareAtPriceCents`   | opcional                        | “De por”    |
| `unitPriceCents` (item) | obrigatório em linhas de pedido |             |

Não enviar `regularPrice` em decimal: use **`compareAtPriceCents`** (ou campos oficiais listados no JSON Schema).

## `productType` (produto)

Valores exatos (não infira sinónimos):

| Valor              | Uso de negócio (resumo)                    |
| ------------------ | ------------------------------------------ |
| `finished_product` | Produto acabado para venda                 |
| `raw_material`     | Insumo / matéria-prima                     |
| `packaging`        | Embalagem, tag, saquinho                   |
| `kit`              | Kit comercial                              |
| `bundle`           | Bundle / agrupamento                       |
| `service`          | Serviço (mão de obra como produto serviço) |
| `consumable`       | Consumível operacional                     |

Erro comum: `finished_good` (Woo) → **não é aceite**; use **`finished_product`**.

## `status` (produto e variante)

Valores: `draft` | `active` | `inactive` | `archived`.

Mapeamento WooCommerce → ERP:

| WooCommerce | ERP                      |
| ----------- | ------------------------ |
| `publish`   | `active`                 |
| `draft`     | `draft`                  |
| `private`   | `inactive` (por defeito) |
| `trash`     | `archived`               |

Não envie **`publish`** no ERP.

## `inventory_movement.data.type`

Valores: `purchase` | `sale` | `return` | `adjustment` | `production_in` | `production_out` | `transfer_in` | `transfer_out` | `damaged` | `reservation` | `release_reservation`.

- **Carga inicial / import de stock legado:** use sempre **`adjustment`**, nunca `initial_stock` (não suportado).
- `notes` pode descrever a origem (ex.: “Import WooCommerce”).

## `product_composition` — `compositionType` vs `productType`

- **`compositionType`** (linha de composição): `packaging` | `bom` | `kit` | `bundle` | `accessory` | `included`.
- Não confundir com **`productType`** do produto filho (`raw_material`, `packaging`, …).
- Tipo **embalagem** no sentido de negócio: use **`compositionType`: `packaging`** e preencha **`packagingChannel`**: `online` ou `presential` (regra do `refineProductComposition`).

## `unitOfMeasure` (produto)

Enum no backend: `unit` | `pair` | `meter` | `gram` | `kg` | `liter` | `package`.

Sistemas externos com `"m"`, `"g"`: mapear para **`meter`** / **`gram`**, ou documentar a unidade em **`metadata`** e usar `quantityUnit` em composição (string livre até 80 chars) para a unidade da **quantidade** da linha.

## `productKind` simple vs variable

- **simple:** movimentos e pedidos podem usar só `productRef` / `productId` no produto.
- **variable:** no mesmo lote, defina `product_variant`(s) com `client_ref`; movimentos e linhas de pedido com `productRef` ao pai exigem **`variantRef` ou `variantId`**.

Definição de eixos de variação no **pai** não tem campo `attributes` de catálogo no `createProduct` — use **`metadata`** para eixos de importação; as variações reais são linhas `product_variant` com `attributes` (mapa string→string).

## `metadata`

- Tipo: objeto com chaves string e valores JSON arbitrários.
- Use para: `sourceSystem`, ids externos, tags, detalhes de custo não modelados, etc.
- Não substitui campos oficiais (`productType`, `status`, preços em centavos, …).

## `client_ref` e referências

- **`client_ref`:** identificador local **no payload** (string única no lote).
- **`*Ref`:** aponta para o `client_ref` de outro objecto do **mesmo** payload.
- **`*Id`:** UUID já persistido no D1/ERP.
- **`externalRef` (PRD-…, PRV-…):** gerado pelo servidor na criação; **não** enviar em modo `create` salvo suporte explícito futuro.

## Exemplos oficiais

Ficheiros em **`docs/examples/ingestion/`** (cada um validado em teste contra `ingestionPayloadSchema`):

1. `01-minimal-category.json`
2. `02-minimal-product-simple.json`
3. `03-product-variable-with-variants.json`
4. `04-product-with-composition-and-costs.json`
5. `05-initial-stock-adjustment.json`
6. `06-supplier-and-purchase-order.json`
7. `07-full-tribus-product-example.json`

## Mensagens de erro com “hint”

O schema Zod de ingestão inclui validações que sugerem correções frequentes (ex.: `finished_good`, `publish`, `initial_stock`). Em caso de falha, ler `issues[].path` e `issues[].message` na resposta `VALIDATION_ERROR`.
