import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  isAppError,
  toApiError,
} from "../../../src/errors/app-error.js";

describe("AppError hierarchy", () => {
  it("NotFoundError has correct code and status", () => {
    const err = new NotFoundError("Product", "abc");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("Product");
    expect(err.message).toContain("abc");
    expect(isAppError(err)).toBe(true);
  });

  it("NotFoundError without id", () => {
    const err = new NotFoundError("Order");
    expect(err.message).toBe("Order not found");
  });

  it("ValidationError stores issues", () => {
    const issues = [{ message: "Required", path: ["name"], code: "invalid_type" as const, expected: "string", received: "undefined" }];
    const err = new ValidationError("Invalid input", issues);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
    expect(err.issues).toHaveLength(1);
  });

  it("ConflictError", () => {
    const err = new ConflictError("SKU already exists");
    expect(err.code).toBe("CONFLICT");
    expect(err.statusCode).toBe(409);
  });

  it("UnauthorizedError defaults message", () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  it("ForbiddenError", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("BadRequestError", () => {
    const err = new BadRequestError("Invalid amount");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Invalid amount");
  });

  it("isAppError returns false for plain Error", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("toApiError maps AppError correctly", () => {
    const err = new NotFoundError("Item", "123");
    const result = toApiError(err);
    expect(result.status).toBe(404);
    expect(result.code).toBe("NOT_FOUND");
  });

  it("toApiError returns 500 for unknown error", () => {
    const result = toApiError(new Error("unknown"));
    expect(result.status).toBe(500);
    expect(result.code).toBe("INTERNAL_ERROR");
  });

  it("toApiError handles non-Error", () => {
    const result = toApiError("string error");
    expect(result.status).toBe(500);
  });
});
