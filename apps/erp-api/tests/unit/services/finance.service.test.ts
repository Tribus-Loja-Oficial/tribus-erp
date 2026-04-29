import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestError, NotFoundError } from "../../../src/errors/app-error.js";

// Pure logic helpers extracted from finance.service for unit testing
function calculateNewPayableStatus(
  currentPaidCents: number,
  addedCents: number,
  totalCents: number,
): "paid" | "partially_paid" {
  return currentPaidCents + addedCents >= totalCents ? "paid" : "partially_paid";
}

function calculateNewReceivableStatus(
  currentReceivedCents: number,
  addedCents: number,
  totalCents: number,
): "received" | "partially_received" {
  return currentReceivedCents + addedCents >= totalCents ? "received" : "partially_received";
}

describe("finance — payable status transitions", () => {
  it("marks as paid when full amount is paid", () => {
    expect(calculateNewPayableStatus(0, 10000, 10000)).toBe("paid");
  });

  it("marks as paid when cumulative payment reaches total", () => {
    expect(calculateNewPayableStatus(5000, 5000, 10000)).toBe("paid");
  });

  it("marks as partially_paid when payment is less than total", () => {
    expect(calculateNewPayableStatus(0, 4999, 10000)).toBe("partially_paid");
  });

  it("marks as paid when overpayment occurs", () => {
    expect(calculateNewPayableStatus(0, 15000, 10000)).toBe("paid");
  });
});

describe("finance — receivable status transitions", () => {
  it("marks as received when full amount is received", () => {
    expect(calculateNewReceivableStatus(0, 20000, 20000)).toBe("received");
  });

  it("marks as partially_received when partial amount received", () => {
    expect(calculateNewReceivableStatus(0, 9999, 20000)).toBe("partially_received");
  });

  it("marks as received when cumulative reaches total", () => {
    expect(calculateNewReceivableStatus(10000, 10000, 20000)).toBe("received");
  });
});

describe("finance — balance delta calculation", () => {
  it("income increases balance", () => {
    const delta = (type: string, amount: number) =>
      type === "income" ? amount : -amount;

    expect(delta("income", 5000)).toBe(5000);
    expect(delta("expense", 5000)).toBe(-5000);
  });
});

describe("AppError types", () => {
  it("NotFoundError has correct code and status", () => {
    const err = new NotFoundError("Product", "abc");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("abc");
  });

  it("BadRequestError has correct code and status", () => {
    const err = new BadRequestError("Invalid data");
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.statusCode).toBe(400);
  });
});
