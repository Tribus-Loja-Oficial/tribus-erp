import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/app/**",
        "src/lib/auth/**",
        "src/components/**",
        "src/features/**",
        "**/*.d.ts",
      ],
      thresholds: { statements: 30, lines: 30, branches: 30, functions: 30 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@tribus-erp/core": resolve(import.meta.dirname, "../../packages/core/src/index.ts"),
    },
  },
});
