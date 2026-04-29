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
      thresholds: { statements: 80, lines: 80, branches: 70, functions: 80 },
    },
  },
});
