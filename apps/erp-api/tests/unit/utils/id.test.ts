import { describe, it, expect } from "vitest";
import { generateId } from "../../../src/utils/id.js";

describe("generateId", () => {
  it("generates a 32-char hex string", () => {
    const id = generateId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
