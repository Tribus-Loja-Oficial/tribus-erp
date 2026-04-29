import { describe, it, expect } from "vitest";

// Stock movement direction logic extracted from inventory.service
const OUT_TYPES = ["sale", "production_out", "transfer_out", "damaged", "reservation"] as const;

type StockMovementType =
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

function isOutwardMovement(type: StockMovementType): boolean {
  return (OUT_TYPES as readonly string[]).includes(type);
}

function calculateStockDelta(type: StockMovementType, quantity: number): number {
  const isOut = isOutwardMovement(type);
  return isOut ? -Math.abs(quantity) : Math.abs(quantity);
}

function wouldGoBelowZero(currentStock: number, delta: number): boolean {
  return currentStock + delta < 0;
}

describe("inventory — movement direction", () => {
  it("sale is outward", () => expect(isOutwardMovement("sale")).toBe(true));
  it("production_out is outward", () => expect(isOutwardMovement("production_out")).toBe(true));
  it("damaged is outward", () => expect(isOutwardMovement("damaged")).toBe(true));
  it("reservation is outward", () => expect(isOutwardMovement("reservation")).toBe(true));
  it("purchase is inward", () => expect(isOutwardMovement("purchase")).toBe(false));
  it("production_in is inward", () => expect(isOutwardMovement("production_in")).toBe(false));
  it("return is inward", () => expect(isOutwardMovement("return")).toBe(false));
  it("transfer_in is inward", () => expect(isOutwardMovement("transfer_in")).toBe(false));
  it("release_reservation is inward", () =>
    expect(isOutwardMovement("release_reservation")).toBe(false));
  it("adjustment is inward", () => expect(isOutwardMovement("adjustment")).toBe(false));
});

describe("inventory — delta calculation", () => {
  it("sale of 5 units reduces stock by 5", () => {
    expect(calculateStockDelta("sale", 5)).toBe(-5);
  });

  it("purchase of 10 units increases stock by 10", () => {
    expect(calculateStockDelta("purchase", 10)).toBe(10);
  });

  it("transfer_out of 3 reduces by 3", () => {
    expect(calculateStockDelta("transfer_out", 3)).toBe(-3);
  });

  it("transfer_in of 3 increases by 3", () => {
    expect(calculateStockDelta("transfer_in", 3)).toBe(3);
  });
});

describe("inventory — stock validation", () => {
  it("detects going below zero on outward movement", () => {
    expect(wouldGoBelowZero(5, -6)).toBe(true);
  });

  it("allows movement that leaves stock at zero", () => {
    expect(wouldGoBelowZero(5, -5)).toBe(false);
  });

  it("allows inward movement always", () => {
    expect(wouldGoBelowZero(0, 10)).toBe(false);
  });

  it("rejects selling more than available", () => {
    const currentStock = 3;
    const quantity = 5;
    const delta = calculateStockDelta("sale", quantity);
    expect(wouldGoBelowZero(currentStock, delta)).toBe(true);
  });
});
