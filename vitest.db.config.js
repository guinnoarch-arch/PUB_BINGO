import { defineConfig } from "vitest/config";

// Database tests: need a Postgres server (DATABASE_URL, default postgres://postgres:postgres@localhost:5432/postgres).
export default defineConfig({
  test: { include: ["tests/db/**/*.test.js"], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false }
});
