import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    env: {
      NODE_ENV: "test",
      DB_URL: "postgresql://unit:unit@127.0.0.1:1/newsapi_unit_test",
      OPENAI_API_KEY: "unit-test-key"
    }
  }
});

