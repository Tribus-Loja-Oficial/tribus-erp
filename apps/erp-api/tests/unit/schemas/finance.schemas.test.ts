import { describe, it, expect } from "vitest";
import {
  createFinancialEntrySchema,
  createPayableSchema,
  payPayableSchema,
  createReceivableSchema,
} from "../../../src/schemas/finance.schemas.js";

describe("createFinancialEntrySchema", () => {
  it("accepts valid income entry", () => {
    const result = createFinancialEntrySchema.safeParse({
      type: "income",
      financialAccountId: "acc-1",
      amountCents: 10000,
      date: "2025-04-01",
      description: "Venda online",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = createFinancialEntrySchema.safeParse({
      type: "income",
      financialAccountId: "acc-1",
      amountCents: 10000,
      date: "01/04/2025",
      description: "Teste",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = createFinancialEntrySchema.safeParse({
      type: "expense",
      financialAccountId: "acc-1",
      amountCents: 0,
      date: "2025-04-01",
      description: "Teste",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = createFinancialEntrySchema.safeParse({
      type: "unknown",
      financialAccountId: "acc-1",
      amountCents: 5000,
      date: "2025-04-01",
      description: "Teste",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPayableSchema", () => {
  it("accepts valid payable", () => {
    const result = createPayableSchema.safeParse({
      description: "Fornecedor ABC",
      dueDate: "2025-05-15",
      amountCents: 50000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing description", () => {
    const result = createPayableSchema.safeParse({
      dueDate: "2025-05-15",
      amountCents: 50000,
    });
    expect(result.success).toBe(false);
  });
});

describe("payPayableSchema", () => {
  it("accepts valid payment", () => {
    const result = payPayableSchema.safeParse({
      amountCents: 50000,
      paymentMethod: "pix",
      financialAccountId: "acc-1",
    });
    expect(result.success).toBe(true);
  });
});

describe("createReceivableSchema", () => {
  it("accepts valid receivable", () => {
    const result = createReceivableSchema.safeParse({
      description: "Pedido #001",
      dueDate: "2025-04-30",
      amountCents: 29900,
    });
    expect(result.success).toBe(true);
  });
});
