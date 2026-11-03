import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{server,shared,web}/src/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
