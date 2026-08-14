import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    // Os defaults do Vitest (5s por teste, 10s por hook) são apertados para esta
    // suíte: a maioria dos beforeAll faz `await import('../server/app')`, que puxa
    // um módulo de ~9.4k linhas, e vários testes passam por bcrypt. Sob os workers
    // em paralelo isso estourava o limite de forma intermitente — a cada run
    // falhava um arquivo diferente, sempre por timeout, nunca por asserção.
    // Prazos maiores não escondem defeito: um teste travado de verdade continua
    // falhando, só que mais tarde.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      reporter: ['text', 'html', 'json-summary'],
      exclude: ['node_modules', 'dist', 'test', '**/*.config.*'],
    },
  },
});
