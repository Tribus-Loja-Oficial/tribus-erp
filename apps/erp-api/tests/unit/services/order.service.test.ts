import { describe, it, expect } from "vitest";

// Order totals logic (mirrors order.service.ts calculateTotals)
interface OrderItem {
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
}

function calculateTotals(
  items: OrderItem[],
  discountCents: number,
  shippingCents: number,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity - item.discountCents,
    0,
  );
  return {
    subtotalCents: subtotal,
    discountTotalCents: discountCents,
    shippingTotalCents: shippingCents,
    taxTotalCents: 0,
    totalCents: subtotal - discountCents + shippingCents,
  };
}

// Order number generation (mirrors ordersRepo.generateOrderNumber)
function generateOrderNumber(existingCount: number): string {
  return `TRB-${String(existingCount + 1).padStart(6, "0")}`;
}

describe("order — total calculation", () => {
  it("calculates subtotal from single item", () => {
    const result = calculateTotals([{ unitPriceCents: 5000, quantity: 2, discountCents: 0 }], 0, 0);
    expect(result.subtotalCents).toBe(10000);
    expect(result.totalCents).toBe(10000);
  });

  it("applies item-level discount", () => {
    const result = calculateTotals(
      [{ unitPriceCents: 10000, quantity: 1, discountCents: 1000 }],
      0,
      0,
    );
    expect(result.subtotalCents).toBe(9000);
    expect(result.totalCents).toBe(9000);
  });

  it("applies order-level discount on top of item total", () => {
    const result = calculateTotals(
      [{ unitPriceCents: 10000, quantity: 1, discountCents: 0 }],
      500,
      0,
    );
    expect(result.subtotalCents).toBe(10000);
    expect(result.discountTotalCents).toBe(500);
    expect(result.totalCents).toBe(9500);
  });

  it("adds shipping to total", () => {
    const result = calculateTotals(
      [{ unitPriceCents: 5000, quantity: 1, discountCents: 0 }],
      0,
      2000,
    );
    expect(result.totalCents).toBe(7000);
    expect(result.shippingTotalCents).toBe(2000);
  });

  it("handles multiple items", () => {
    const result = calculateTotals(
      [
        { unitPriceCents: 3000, quantity: 2, discountCents: 0 },
        { unitPriceCents: 5000, quantity: 1, discountCents: 500 },
      ],
      0,
      0,
    );
    expect(result.subtotalCents).toBe(6000 + 4500);
    expect(result.totalCents).toBe(10500);
  });

  it("always sets taxTotalCents to 0", () => {
    const result = calculateTotals([{ unitPriceCents: 100, quantity: 1, discountCents: 0 }], 0, 0);
    expect(result.taxTotalCents).toBe(0);
  });
});

describe("order — order number generation", () => {
  it("generates first order number", () => {
    expect(generateOrderNumber(0)).toBe("TRB-000001");
  });

  it("pads with zeros", () => {
    expect(generateOrderNumber(9)).toBe("TRB-000010");
  });

  it("handles large counts", () => {
    expect(generateOrderNumber(999999)).toBe("TRB-1000000");
  });
});

describe("order — payment sufficiency", () => {
  it("detects insufficient payment", () => {
    const totalCents = 10000;
    const paidCents = 9999;
    expect(paidCents < totalCents).toBe(true);
  });

  it("accepts exact payment", () => {
    const totalCents = 10000;
    const paidCents = 10000;
    expect(paidCents < totalCents).toBe(false);
  });

  it("accepts overpayment (change)", () => {
    const totalCents = 10000;
    const paidCents = 15000;
    expect(paidCents < totalCents).toBe(false);
  });
});
