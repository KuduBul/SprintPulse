import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Property-based tests run 100+ iterations and can exceed the 5s default
    // under load (e.g. during `npm run verify`). A higher ceiling prevents
    // load-induced flaky timeouts without masking real hangs.
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    // Smoke tests hit a real database and run under their own config
    // (vitest.smoke.config.ts). Exclude them from the mocked unit/property run
    // so they aren't executed twice (and with the wrong environment/timeout).
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      'tests/smoke/**',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'vitest.config.ts',
        'vitest.setup.ts',
        'next.config.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/app': path.resolve(__dirname, './app'),
    },
  },
});
