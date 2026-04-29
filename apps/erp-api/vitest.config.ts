import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/db/**",
        "src/repositories/**",
        "src/services/**",
        "src/routes/**",
        "src/index.ts",
        "src/observability/**",
        "src/storage/**",
        "src/config/env.ts",
        "**/*.d.ts",
      ],
      thresholds: { statements: 10, lines: 10, branches: 10, functions: 10 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@tribus-erp/core": resolve(import.meta.dirname, "../../packages/core/src/index.ts"),
    },
  },
});
