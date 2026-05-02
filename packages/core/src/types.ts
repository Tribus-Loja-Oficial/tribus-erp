export type PartyType = "individual" | "company";
export type DocumentType = "cpf" | "cnpj" | "foreign" | "unknown";
export type PartyRole = "customer" | "supplier" | "employee" | "carrier" | "contact";

export type ProductType =
  | "finished_product"
  | "raw_material"
  | "packaging"
  | "kit"
  | "bundle"
  | "service"
  | "consumable";
export type ProductStatus = "draft" | "active" | "inactive" | "archived";

export type StockMovementType =
  | "purchase"
  | "sale"
  | "return"
  | "adjustment"
  | "production_in"
  | "production_out"
  | "transfer_in"
  | "transfer_out"
  | "damaged"
  | "reservation"
  | "release_reservation";

export type StockLocationType =
  | "main"
  | "event"
  | "production"
  | "damaged"
  | "reserved"
  | "third_party";

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type OrderChannel = "ecommerce" | "pos" | "manual" | "event" | "marketplace";
export type OrderSourceSystem = "tribus-commerce" | "woocommerce" | "manual" | "pdv";
export type PaymentStatus = "pending" | "paid" | "partial" | "refunded" | "failed";
export type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "pix"
  | "bank_transfer"
  | "marketplace"
  | "other";

export type CashSessionStatus = "open" | "closed" | "reconciled";
export type CashMovementType = "sale" | "refund" | "cash_in" | "cash_out" | "adjustment" | "fee";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type FinancialAccountType =
  | "bank"
  | "cash"
  | "credit_card"
  | "payment_gateway"
  | "marketplace";

export type FinancialEntryType = "income" | "expense" | "transfer" | "adjustment";

export type PayableStatus = "open" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type ReceivableStatus = "open" | "partially_received" | "received" | "overdue" | "cancelled";

export type FiscalDocumentType = "nfe" | "nfce" | "nfse" | "cte" | "other";

export type IntegrationEventStatus = "pending" | "processed" | "failed" | "skipped";
