import { defineConfig } from 'vitest/config';
import { z } from 'zod';

// Never fall back to DB_URL: this suite clears tables in its dedicated database.
const testDatabaseUrl = z.string().url().parse(process.env.TEST_DB_URL);
const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  throw new Error('TEST_DB_URL must name a dedicated database ending in _test');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DB_URL: testDatabaseUrl,
      OPENAI_API_KEY: 'integration-test-key',
    },
  },
});
