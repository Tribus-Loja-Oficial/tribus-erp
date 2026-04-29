import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "**/*.d.ts"],
      thresholds: { statements: 10, lines: 10, branches: 10, functions: 10 },
    },
  },
});
