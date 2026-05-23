import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Integration tests hit the real Postgres (Neon in this repo's setup) and
// occasionally the real Drive. They live alongside features in
// __integration__/ directories so the regular `pnpm test` (unit / jsdom)
// stays fast.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__integration__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'tests/e2e', 'playwright-report', 'test-results'],
    // Real Postgres round-trips from local → ap-southeast-1 ≈ 250 ms;
    // some tests issue 10+ statements, give them headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run sequentially — the shared DB makes parallel test interference
    // possible, and we want deterministic ordering for cleanup.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
