import { describe, it, expect } from "vitest";
import { assertSafeHttpsImageUrl } from "../../../src/utils/safe-image-url.js";
import { BadRequestError } from "../../../src/errors/app-error.js";

describe("assertSafeHttpsImageUrl", () => {
  it("accepts public https URL", () => {
    const u = assertSafeHttpsImageUrl("https://cdn.example.com/path/photo.jpg");
    expect(u.hostname).toBe("cdn.example.com");
  });

  it("rejects http", () => {
    expect(() => assertSafeHttpsImageUrl("http://example.com/x.jpg")).toThrow(BadRequestError);
  });

  it("rejects localhost", () => {
    expect(() => assertSafeHttpsImageUrl("https://localhost/x.jpg")).toThrow(BadRequestError);
  });

  it("rejects private IPv4 hostname", () => {
    expect(() => assertSafeHttpsImageUrl("https://192.168.1.1/x.jpg")).toThrow(BadRequestError);
    expect(() => assertSafeHttpsImageUrl("https://10.0.0.1/x.jpg")).toThrow(BadRequestError);
  });

  it("rejects URL with credentials", () => {
    expect(() => assertSafeHttpsImageUrl("https://user:pass@example.com/x.jpg")).toThrow(
      BadRequestError,
    );
  });
});
