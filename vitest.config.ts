import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { LOG_LEVEL: "silent" },
    // One in-memory MongoDB replica set is shared by all test files.
    globalSetup: ["src/lib/payments/global-setup.ts"],
    hookTimeout: 180_000,
  },
});
