import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: { reporter: ['text', 'html'] },
    // __integration__ suites are picked up by vitest.integration.config.ts
    // — they hit a real DB and need their own runner.
    exclude: [
      'node_modules',
      '.next',
      'tests/e2e',
      'playwright-report',
      'test-results',
      'src/**/__integration__/**',
    ],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
