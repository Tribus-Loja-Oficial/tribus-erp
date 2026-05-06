import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Parties ────────────────────────────────────────────────────────────────

export const parties = sqliteTable(
  "parties",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["individual", "company"] }).notNull(),
    legalName: text("legal_name").notNull(),
    tradeName: text("trade_name"),
    documentType: text("document_type", {
      enum: ["cpf", "cnpj", "foreign", "unknown"],
    })
      .notNull()
      .default("unknown"),
    documentNumber: text("document_number"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    cdsConsumerId: text("cds_consumer_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("parties_document_idx").on(t.documentNumber),
    index("parties_email_idx").on(t.email),
  ],
);

export const partyAddresses = sqliteTable("party_addresses", {
  id: text("id").primaryKey(),
  partyId: text("party_id")
    .notNull()
    .references(() => parties.id),
  label: text("label").notNull().default("principal"),
  street: text("street").notNull(),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("BR"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Customers & Suppliers ──────────────────────────────────────────────────

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  partyId: text("party_id")
    .notNull()
    .references(() => parties.id),
  cdsConsumerId: text("cds_consumer_id"),
  origin: text("origin", { enum: ["ecommerce", "event", "manual", "imported"] })
    .notNull()
    .default("manual"),
  firstPurchaseAt: text("first_purchase_at"),
  lastPurchaseAt: text("last_purchase_at"),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpentCents: integer("total_spent_cents").notNull().default(0),
  notes: text("notes"),
  status: text("status", { enum: ["active", "inactive", "blocked"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  partyId: text("party_id")
    .notNull()
    .references(() => parties.id),
  stateRegistration: text("state_registration"),
  municipalRegistration: text("municipal_registration"),
  contactName: text("contact_name"),
  website: text("website"),
  marketplace: text("marketplace"),
  notes: text("notes"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
});

// ─── Products ───────────────────────────────────────────────────────────────

export const productCategories = sqliteTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: text("parent_id"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
});

export const productCollections = sqliteTable("product_collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  niche: text("niche"),
  season: text("season"),
  status: text("status", { enum: ["draft", "active", "archived"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    /** Referência humana estável (ex.: PRD-0001); gerada pelo servidor. */
    externalRef: text("external_ref").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    shortDescription: text("short_description"),
    internalName: text("internal_name"),
    internalDescription: text("internal_description"),
    productType: text("product_type", {
      enum: [
        "finished_product",
        "raw_material",
        "packaging",
        "kit",
        "bundle",
        "service",
        "consumable",
      ],
    })
      .notNull()
      .default("finished_product"),
    /** simple = cadastro único; variable = pai com variações vendáveis/estocáveis. */
    productKind: text("product_kind", { enum: ["simple", "variable"] })
      .notNull()
      .default("simple"),
    categoryId: text("category_id").references(() => productCategories.id),
    collectionId: text("collection_id").references(() => productCollections.id),
    niche: text("niche"),
    brand: text("brand"),
    status: text("status", { enum: ["draft", "active", "inactive", "archived"] })
      .notNull()
      .default("draft"),
    unitOfMeasure: text("unit_of_measure").notNull().default("unit"),
    barcode: text("barcode"),
    ncm: text("ncm"),
    cest: text("cest"),
    cfopDefault: text("cfop_default"),
    origin: text("origin").default("0"),
    costPriceCents: integer("cost_price_cents").notNull().default(0),
    salePriceCents: integer("sale_price_cents").notNull().default(0),
    compareAtPriceCents: integer("compare_at_price_cents"),
    promotionalPriceCents: integer("promotional_price_cents"),
    eventPriceCents: integer("event_price_cents"),
    wholesalePriceCents: integer("wholesale_price_cents"),
    controlsStock: integer("controls_stock", { mode: "boolean" }).notNull().default(true),
    currentStock: integer("current_stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    maxStock: integer("max_stock"),
    idealStock: integer("ideal_stock"),
    defaultStockLocationId: text("default_stock_location_id").references(() => stockLocations.id),
    weightGrams: integer("weight_grams"),
    lengthCm: real("length_cm"),
    widthCm: real("width_cm"),
    heightCm: real("height_cm"),
    purchaseUnit: text("purchase_unit"),
    purchaseQuantity: real("purchase_quantity"),
    consumptionUnit: text("consumption_unit"),
    acquisitionCostCents: integer("acquisition_cost_cents"),
    costPerConsumptionUnitCents: real("cost_per_consumption_unit_cents"),
    averageCostDecimal: real("average_cost_decimal"),
    averageCostUnit: text("average_cost_unit"),
    lastPurchaseCostDecimal: real("last_purchase_cost_decimal"),
    lastPurchaseDate: text("last_purchase_date"),
    costSource: text("cost_source", {
      enum: ["legacy_ingestion", "manual", "purchase_average", "unknown"],
    })
      .notNull()
      .default("unknown"),
    costUpdatedAt: text("cost_updated_at"),
    producedInternally: integer("produced_internally", { mode: "boolean" })
      .notNull()
      .default(false),
    averageProductionTimeMinutes: integer("average_production_time_minutes"),
    sellable: integer("sellable", { mode: "boolean" }).notNull().default(true),
    availableForEcommerce: integer("available_for_ecommerce", { mode: "boolean" })
      .notNull()
      .default(true),
    availableForPos: integer("available_for_pos", { mode: "boolean" }).notNull().default(true),
    availableForEvents: integer("available_for_events", { mode: "boolean" })
      .notNull()
      .default(false),
    mainImageFileId: text("main_image_file_id"),
    imagesJson: text("images_json").default("[]"),
    attributesJson: text("attributes_json").default("{}"),
    metadataJson: text("metadata_json").default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
    index("products_sku_idx").on(t.sku),
  ],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    /** Referência humana estável (ex.: PRV-0001); gerada pelo servidor. */
    externalRef: text("external_ref").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name"),
    attributesJson: text("attributes_json").default("{}"),
    /** null = herdar preço de venda do produto pai */
    salePriceCents: integer("sale_price_cents"),
    /** null = herdar custo do produto pai */
    costPriceCents: integer("cost_price_cents"),
    promotionalPriceCents: integer("promotional_price_cents"),
    eventPriceCents: integer("event_price_cents"),
    wholesalePriceCents: integer("wholesale_price_cents"),
    controlsStock: integer("controls_stock", { mode: "boolean" }).notNull().default(true),
    currentStock: integer("current_stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    idealStock: integer("ideal_stock"),
    barcode: text("barcode"),
    weightGrams: integer("weight_grams"),
    lengthCm: real("length_cm"),
    widthCm: real("width_cm"),
    heightCm: real("height_cm"),
    mainImageFileId: text("main_image_file_id"),
    metadataJson: text("metadata_json").default("{}"),
    status: text("status", { enum: ["draft", "active", "inactive", "archived"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const productCompositions = sqliteTable(
  "product_compositions",
  {
    id: text("id").primaryKey(),
    parentProductId: text("parent_product_id")
      .notNull()
      .references(() => products.id),
    /** Se preenchido, composição aplica-se só à variação (MVP: null = nível produto). */
    parentVariantId: text("parent_variant_id").references(() => productVariants.id),
    childProductId: text("child_product_id")
      .notNull()
      .references(() => products.id),
    /** Futuro: componente como variação específica. */
    childVariantId: text("child_variant_id").references(() => productVariants.id),
    quantity: real("quantity").notNull(),
    quantityUnit: text("quantity_unit"),
    compositionType: text("composition_type", {
      enum: ["packaging", "bom", "kit", "bundle", "accessory", "included"],
    }).notNull(),
    packagingChannel: text("packaging_channel", {
      enum: ["online", "presential"],
    }),
    unitCostSnapshotCents: real("unit_cost_snapshot_cents"),
    totalCostSnapshotCents: real("total_cost_snapshot_cents"),
    required: integer("required", { mode: "boolean" }).notNull().default(true),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("product_compositions_parent_idx").on(t.parentProductId),
    index("product_compositions_child_idx").on(t.childProductId),
  ],
);

export const productProductionProfiles = sqliteTable(
  "product_production_profiles",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .unique()
      .references(() => products.id),
    producedInternally: integer("produced_internally", { mode: "boolean" })
      .notNull()
      .default(false),
    averageProductionTimeMinutes: integer("average_production_time_minutes"),
    laborCostPerHourCents: integer("labor_cost_per_hour_cents"),
    laborCostCalculatedCents: integer("labor_cost_calculated_cents"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("product_production_profiles_product_idx").on(t.productId)],
);

// ─── Inventory ──────────────────────────────────────────────────────────────

export const stockLocations = sqliteTable("stock_locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["main", "event", "production", "damaged", "reserved", "third_party"],
  })
    .notNull()
    .default("main"),
  address: text("address"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    variantId: text("variant_id").references(() => productVariants.id),
    locationId: text("location_id")
      .notNull()
      .references(() => stockLocations.id),
    type: text("type", {
      enum: [
        "purchase",
        "sale",
        "return",
        "adjustment",
        "production_in",
        "production_out",
        "transfer_in",
        "transfer_out",
        "damaged",
        "reservation",
        "release_reservation",
      ],
    }).notNull(),
    quantity: integer("quantity").notNull(),
    unitCostCents: integer("unit_cost_cents"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId),
    index("stock_movements_location_idx").on(t.locationId),
    index("stock_movements_created_at_idx").on(t.createdAt),
  ],
);

// ─── Orders ─────────────────────────────────────────────────────────────────

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    channel: text("channel", {
      enum: ["ecommerce", "pos", "manual", "event", "marketplace"],
    })
      .notNull()
      .default("manual"),
    sourceSystem: text("source_system", {
      enum: ["tribus-commerce", "woocommerce", "manual", "pdv"],
    })
      .notNull()
      .default("manual"),
    sourceExternalId: text("source_external_id"),
    customerId: text("customer_id").references(() => customers.id),
    status: text("status", {
      enum: [
        "draft",
        "pending_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
    })
      .notNull()
      .default("draft"),
    paymentStatus: text("payment_status", {
      enum: ["pending", "paid", "partial", "refunded", "failed"],
    })
      .notNull()
      .default("pending"),
    fulfillmentStatus: text("fulfillment_status", {
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
    })
      .notNull()
      .default("pending"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountTotalCents: integer("discount_total_cents").notNull().default(0),
    shippingTotalCents: integer("shipping_total_cents").notNull().default(0),
    taxTotalCents: integer("tax_total_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    notes: text("notes"),
    metadataJson: text("metadata_json").default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_customer_idx").on(t.customerId),
    index("orders_channel_idx").on(t.channel),
    uniqueIndex("orders_source_external_idx").on(t.sourceSystem, t.sourceExternalId),
  ],
);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  productId: text("product_id").references(() => products.id),
  variantId: text("variant_id").references(() => productVariants.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  createdAt: text("created_at").notNull(),
});

export const orderPayments = sqliteTable("order_payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  method: text("method", {
    enum: ["cash", "credit_card", "debit_card", "pix", "bank_transfer", "marketplace", "other"],
  }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["pending", "confirmed", "failed", "refunded"] })
    .notNull()
    .default("pending"),
  externalRef: text("external_ref"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── PDV / Cash ─────────────────────────────────────────────────────────────

export const cashRegisters = sqliteTable("cash_registers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const cashSessions = sqliteTable(
  "cash_sessions",
  {
    id: text("id").primaryKey(),
    cashRegisterId: text("cash_register_id")
      .notNull()
      .references(() => cashRegisters.id),
    openedBy: text("opened_by").notNull(),
    openedAt: text("opened_at").notNull(),
    openingAmountCents: integer("opening_amount_cents").notNull().default(0),
    closedBy: text("closed_by"),
    closedAt: text("closed_at"),
    closingAmountCents: integer("closing_amount_cents"),
    expectedAmountCents: integer("expected_amount_cents"),
    differenceAmountCents: integer("difference_amount_cents"),
    status: text("status", { enum: ["open", "closed", "reconciled"] })
      .notNull()
      .default("open"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("cash_sessions_status_idx").on(t.status)],
);

export const cashMovements = sqliteTable("cash_movements", {
  id: text("id").primaryKey(),
  cashSessionId: text("cash_session_id")
    .notNull()
    .references(() => cashSessions.id),
  type: text("type", {
    enum: ["sale", "refund", "cash_in", "cash_out", "adjustment", "fee"],
  }).notNull(),
  paymentMethod: text("payment_method", {
    enum: ["cash", "credit_card", "debit_card", "pix", "bank_transfer", "marketplace", "other"],
  }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ─── Finance ────────────────────────────────────────────────────────────────

export const chartOfAccounts = sqliteTable("chart_of_accounts", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["asset", "liability", "equity", "revenue", "expense"],
  }).notNull(),
  parentId: text("parent_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const costCenters = sqliteTable("cost_centers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const financialAccounts = sqliteTable("financial_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["bank", "cash", "credit_card", "payment_gateway", "marketplace"],
  }).notNull(),
  institution: text("institution"),
  currency: text("currency").notNull().default("BRL"),
  openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
  currentBalanceCents: integer("current_balance_cents").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const financialEntries = sqliteTable(
  "financial_entries",
  {
    id: text("id").primaryKey(),
    type: text("type", {
      enum: ["income", "expense", "transfer", "adjustment"],
    }).notNull(),
    financialAccountId: text("financial_account_id")
      .notNull()
      .references(() => financialAccounts.id),
    categoryId: text("category_id").references(() => chartOfAccounts.id),
    costCenterId: text("cost_center_id").references(() => costCenters.id),
    amountCents: integer("amount_cents").notNull(),
    date: text("date").notNull(),
    competenceDate: text("competence_date"),
    description: text("description").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    documentId: text("document_id"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("financial_entries_date_idx").on(t.date),
    index("financial_entries_type_idx").on(t.type),
    index("financial_entries_account_idx").on(t.financialAccountId),
  ],
);

export const accountsPayable = sqliteTable(
  "accounts_payable",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").references(() => suppliers.id),
    description: text("description").notNull(),
    dueDate: text("due_date").notNull(),
    competenceDate: text("competence_date"),
    amountCents: integer("amount_cents").notNull(),
    paidAmountCents: integer("paid_amount_cents").notNull().default(0),
    status: text("status", {
      enum: ["open", "partially_paid", "paid", "overdue", "cancelled"],
    })
      .notNull()
      .default("open"),
    categoryId: text("category_id").references(() => chartOfAccounts.id),
    costCenterId: text("cost_center_id").references(() => costCenters.id),
    paymentMethod: text("payment_method"),
    documentId: text("document_id"),
    notes: text("notes"),
    paidAt: text("paid_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("accounts_payable_due_date_idx").on(t.dueDate),
    index("accounts_payable_status_idx").on(t.status),
  ],
);

export const accountsReceivable = sqliteTable(
  "accounts_receivable",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id),
    orderId: text("order_id").references(() => orders.id),
    description: text("description").notNull(),
    dueDate: text("due_date").notNull(),
    competenceDate: text("competence_date"),
    amountCents: integer("amount_cents").notNull(),
    receivedAmountCents: integer("received_amount_cents").notNull().default(0),
    status: text("status", {
      enum: ["open", "partially_received", "received", "overdue", "cancelled"],
    })
      .notNull()
      .default("open"),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    receivedAt: text("received_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("accounts_receivable_due_date_idx").on(t.dueDate),
    index("accounts_receivable_status_idx").on(t.status),
  ],
);

// ─── Fiscal ─────────────────────────────────────────────────────────────────

export const fiscalDocuments = sqliteTable(
  "fiscal_documents",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["nfe", "nfce", "nfse", "cte", "other"] }).notNull(),
    accessKey: text("access_key").unique(),
    number: text("number"),
    series: text("series"),
    issueDate: text("issue_date").notNull(),
    emitterPartyId: text("emitter_party_id").references(() => parties.id),
    recipientPartyId: text("recipient_party_id").references(() => parties.id),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    xmlFileId: text("xml_file_id"),
    status: text("status", { enum: ["active", "cancelled", "pending"] })
      .notNull()
      .default("active"),
    rawXmlStorageKey: text("raw_xml_storage_key"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("fiscal_documents_type_idx").on(t.type),
    index("fiscal_documents_issue_date_idx").on(t.issueDate),
  ],
);

export const fiscalDocumentItems = sqliteTable("fiscal_document_items", {
  id: text("id").primaryKey(),
  fiscalDocumentId: text("fiscal_document_id")
    .notNull()
    .references(() => fiscalDocuments.id),
  productId: text("product_id").references(() => products.id),
  description: text("description").notNull(),
  ncm: text("ncm"),
  cfop: text("cfop"),
  quantity: real("quantity").notNull(),
  unitValue: real("unit_value").notNull(),
  totalValue: real("total_value").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Documents ──────────────────────────────────────────────────────────────

export const documentFiles = sqliteTable("document_files", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  uploadedBy: text("uploaded_by"),
  metadataJson: text("metadata_json").default("{}"),
  createdAt: text("created_at").notNull(),
});

// ─── Audit & Integration ────────────────────────────────────────────────────

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    actorType: text("actor_type", { enum: ["user", "system", "api"] })
      .notNull()
      .default("user"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    requestId: text("request_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

export const integrationEvents = sqliteTable(
  "integration_events",
  {
    id: text("id").primaryKey(),
    sourceSystem: text("source_system").notNull(),
    eventType: text("event_type").notNull(),
    externalId: text("external_id"),
    payloadJson: text("payload_json").notNull(),
    status: text("status", { enum: ["pending", "processed", "failed", "skipped"] })
      .notNull()
      .default("pending"),
    errorMessage: text("error_message"),
    processedAt: text("processed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("integration_events_status_idx").on(t.status),
    uniqueIndex("integration_events_external_idx").on(t.sourceSystem, t.eventType, t.externalId),
  ],
);

export const ingestionJobs = sqliteTable(
  "ingestion_jobs",
  {
    id: text("id").primaryKey(),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed"],
    }).notNull(),
    payloadJson: text("payload_json").notNull(),
    progressProcessed: integer("progress_processed").notNull().default(0),
    progressTotal: integer("progress_total").notNull().default(0),
    resultJson: text("result_json"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    /** JSON: cursor, refMap, items, counts — entre mensagens da fila (ingestão chunked). */
    chunkStateJson: text("chunk_state_json"),
  },
  (t) => [
    index("ingestion_jobs_status_idx").on(t.status),
    index("ingestion_jobs_created_at_idx").on(t.createdAt),
  ],
);

// ─── Purchases ──────────────────────────────────────────────────────────────

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").references(() => suppliers.id),
    status: text("status", {
      enum: ["draft", "ordered", "partially_received", "received", "cancelled"],
    })
      .notNull()
      .default("draft"),
    issueDate: text("issue_date").notNull(),
    expectedDate: text("expected_date"),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    freightAmountCents: integer("freight_amount_cents").notNull().default(0),
    discountAmountCents: integer("discount_amount_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("purchase_orders_status_idx").on(t.status),
    index("purchase_orders_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: text("id").primaryKey(),
  purchaseOrderId: text("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  productId: text("product_id").references(() => products.id),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalPriceCents: integer("total_price_cents").notNull(),
  receivedQuantity: real("received_quantity").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const purchaseReceipts = sqliteTable(
  "purchase_receipts",
  {
    id: text("id").primaryKey(),
    externalRef: text("external_ref"),
    purchaseOrderId: text("purchase_order_id").references(() => purchaseOrders.id),
    supplierId: text("supplier_id").references(() => suppliers.id),
    issueDate: text("issue_date").notNull(),
    receivedAt: text("received_at").notNull(),
    documentNumber: text("document_number"),
    documentType: text("document_type", {
      enum: ["manual", "nfe_xml", "receipt", "invoice", "legacy_import"],
    })
      .notNull()
      .default("manual"),
    sourceSystem: text("source_system"),
    notes: text("notes"),
    metadataJson: text("metadata_json").default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("purchase_receipts_external_ref_idx").on(t.externalRef),
    index("purchase_receipts_supplier_idx").on(t.supplierId),
    index("purchase_receipts_purchase_order_idx").on(t.purchaseOrderId),
    index("purchase_receipts_received_at_idx").on(t.receivedAt),
  ],
);

export const purchaseReceiptItems = sqliteTable(
  "purchase_receipt_items",
  {
    id: text("id").primaryKey(),
    purchaseReceiptId: text("purchase_receipt_id")
      .notNull()
      .references(() => purchaseReceipts.id),
    purchaseOrderItemId: text("purchase_order_item_id").references(() => purchaseOrderItems.id),
    productId: text("product_id").references(() => products.id),
    description: text("description"),
    purchasedQuantity: real("purchased_quantity").notNull(),
    purchaseUnit: text("purchase_unit").notNull(),
    conversionFactorToStockUnit: real("conversion_factor_to_stock_unit").notNull(),
    stockQuantity: real("stock_quantity").notNull(),
    stockUnit: text("stock_unit").notNull(),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    discountAmountCents: integer("discount_amount_cents").notNull().default(0),
    freightAmountCents: integer("freight_amount_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    otherCostAmountCents: integer("other_cost_amount_cents").notNull().default(0),
    totalCostCents: integer("total_cost_cents").notNull(),
    unitCostDecimal: real("unit_cost_decimal").notNull(),
    notes: text("notes"),
    metadataJson: text("metadata_json").default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("purchase_receipt_items_receipt_idx").on(t.purchaseReceiptId),
    index("purchase_receipt_items_product_idx").on(t.productId),
  ],
);

export const inventoryValuationEvents = sqliteTable(
  "inventory_valuation_events",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    quantityBefore: real("quantity_before").notNull().default(0),
    valueBeforeCents: integer("value_before_cents").notNull().default(0),
    quantityIn: real("quantity_in").notNull().default(0),
    valueInCents: integer("value_in_cents").notNull().default(0),
    quantityAfter: real("quantity_after").notNull().default(0),
    valueAfterCents: integer("value_after_cents").notNull().default(0),
    averageCostBeforeDecimal: real("average_cost_before_decimal"),
    averageCostAfterDecimal: real("average_cost_after_decimal"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("inventory_valuation_events_product_idx").on(t.productId, t.createdAt)],
);

export const productCostSnapshots = sqliteTable(
  "product_cost_snapshots",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    snapshotDate: text("snapshot_date").notNull(),
    source: text("source", {
      enum: [
        "legacy_ingestion",
        "manual",
        "purchase_recalculation",
        "production_order",
        "pricing_review",
      ],
    }).notNull(),
    bomVersionId: text("bom_version_id"),
    materialCostCents: integer("material_cost_cents").notNull().default(0),
    packagingCostCents: integer("packaging_cost_cents").notNull().default(0),
    laborCostCents: integer("labor_cost_cents").notNull().default(0),
    totalCostCents: integer("total_cost_cents").notNull().default(0),
    componentCostsJson: text("component_costs_json").default("[]"),
    metadataJson: text("metadata_json").default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("product_cost_snapshots_product_idx").on(t.productId, t.snapshotDate)],
);

// ─── Product Tags ────────────────────────────────────────────────────────────

export const productTags = sqliteTable("product_tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const productTagAssignments = sqliteTable(
  "product_tag_assignments",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    tagId: text("tag_id")
      .notNull()
      .references(() => productTags.id),
  },
  (t) => [uniqueIndex("product_tag_assignment_idx").on(t.productId, t.tagId)],
);

// ─── Bill of Materials ───────────────────────────────────────────────────────

export const billOfMaterials = sqliteTable(
  "bill_of_materials",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    version: text("version").notNull().default("1.0"),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [index("bom_product_idx").on(t.productId)],
);

export const bomItems = sqliteTable("bom_items", {
  id: text("id").primaryKey(),
  bomId: text("bom_id")
    .notNull()
    .references(() => billOfMaterials.id),
  componentProductId: text("component_product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull().default("un"),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// ─── Production Orders ───────────────────────────────────────────────────────

export const productionOrders = sqliteTable(
  "production_orders",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    bomId: text("bom_id").references(() => billOfMaterials.id),
    orderNumber: text("order_number").notNull().unique(),
    quantityPlanned: integer("quantity_planned").notNull(),
    quantityProduced: integer("quantity_produced").notNull().default(0),
    status: text("status", {
      enum: ["planned", "in_progress", "completed", "cancelled"],
    })
      .notNull()
      .default("planned"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [
    index("production_orders_status_idx").on(t.status),
    index("production_orders_product_idx").on(t.productId),
  ],
);

export const productionOrderConsumptions = sqliteTable("production_order_consumptions", {
  id: text("id").primaryKey(),
  productionOrderId: text("production_order_id")
    .notNull()
    .references(() => productionOrders.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantityPlanned: real("quantity_planned").notNull(),
  quantityConsumed: real("quantity_consumed").notNull().default(0),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const productionOrderLosses = sqliteTable("production_order_losses", {
  id: text("id").primaryKey(),
  productionOrderId: text("production_order_id")
    .notNull()
    .references(() => productionOrders.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

// ─── Relations ──────────────────────────────────────────────────────────────

export const partiesRelations = relations(parties, ({ many }) => ({
  addresses: many(partyAddresses),
  customerProfiles: many(customers),
  supplierProfiles: many(suppliers),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  collection: one(productCollections, {
    fields: [products.collectionId],
    references: [productCollections.id],
  }),
  variants: many(productVariants),
  stockMovements: many(stockMovements),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
  payments: many(orderPayments),
}));

export const cashSessionsRelations = relations(cashSessions, ({ one, many }) => ({
  register: one(cashRegisters, {
    fields: [cashSessions.cashRegisterId],
    references: [cashRegisters.id],
  }),
  movements: many(cashMovements),
}));

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductComposition = typeof productCompositions.$inferSelect;
export type NewProductComposition = typeof productCompositions.$inferInsert;
export type ProductProductionProfile = typeof productProductionProfiles.$inferSelect;
export type NewProductProductionProfile = typeof productProductionProfiles.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type StockLocation = typeof stockLocations.$inferSelect;
export type NewStockLocation = typeof stockLocations.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderPayment = typeof orderPayments.$inferSelect;
export type NewOrderPayment = typeof orderPayments.$inferInsert;
export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type NewFinancialAccount = typeof financialAccounts.$inferInsert;
export type CashRegister = typeof cashRegisters.$inferSelect;
export type NewCashRegister = typeof cashRegisters.$inferInsert;
export type PartyAddress = typeof partyAddresses.$inferSelect;
export type NewPartyAddress = typeof partyAddresses.$inferInsert;
export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;
export type ProductCollectionRow = typeof productCollections.$inferSelect;
export type NewProductCollection = typeof productCollections.$inferInsert;
export type CashSession = typeof cashSessions.$inferSelect;
export type NewCashSession = typeof cashSessions.$inferInsert;
export type CashMovement = typeof cashMovements.$inferSelect;
export type NewCashMovement = typeof cashMovements.$inferInsert;
export type FinancialEntry = typeof financialEntries.$inferSelect;
export type NewFinancialEntry = typeof financialEntries.$inferInsert;
export type AccountPayable = typeof accountsPayable.$inferSelect;
export type NewAccountPayable = typeof accountsPayable.$inferInsert;
export type AccountReceivable = typeof accountsReceivable.$inferSelect;
export type NewAccountReceivable = typeof accountsReceivable.$inferInsert;
export type FiscalDocument = typeof fiscalDocuments.$inferSelect;
export type NewFiscalDocument = typeof fiscalDocuments.$inferInsert;
export type FiscalDocumentItem = typeof fiscalDocumentItems.$inferSelect;
export type NewFiscalDocumentItem = typeof fiscalDocumentItems.$inferInsert;
export type DocumentFile = typeof documentFiles.$inferSelect;
export type NewDocumentFile = typeof documentFiles.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type NewIntegrationEvent = typeof integrationEvents.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
export type PurchaseReceipt = typeof purchaseReceipts.$inferSelect;
export type NewPurchaseReceipt = typeof purchaseReceipts.$inferInsert;
export type PurchaseReceiptItem = typeof purchaseReceiptItems.$inferSelect;
export type NewPurchaseReceiptItem = typeof purchaseReceiptItems.$inferInsert;
export type InventoryValuationEvent = typeof inventoryValuationEvents.$inferSelect;
export type NewInventoryValuationEvent = typeof inventoryValuationEvents.$inferInsert;
export type ProductCostSnapshot = typeof productCostSnapshots.$inferSelect;
export type NewProductCostSnapshot = typeof productCostSnapshots.$inferInsert;
export type ProductTag = typeof productTags.$inferSelect;
export type NewProductTag = typeof productTags.$inferInsert;
export type BillOfMaterials = typeof billOfMaterials.$inferSelect;
export type NewBillOfMaterials = typeof billOfMaterials.$inferInsert;
export type BomItem = typeof bomItems.$inferSelect;
export type NewBomItem = typeof bomItems.$inferInsert;
export type ProductionOrder = typeof productionOrders.$inferSelect;
export type NewProductionOrder = typeof productionOrders.$inferInsert;
export type ProductionOrderConsumption = typeof productionOrderConsumptions.$inferSelect;
export type NewProductionOrderConsumption = typeof productionOrderConsumptions.$inferInsert;
export type ProductionOrderLoss = typeof productionOrderLosses.$inferSelect;
export type NewProductionOrderLoss = typeof productionOrderLosses.$inferInsert;
