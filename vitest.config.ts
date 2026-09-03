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
    // O gargalo destes hooks é um só: `await import('../server/app')` puxa um
    // módulo de ~9.700 linhas, e oito arquivos de teste fazem isso. Sob 22
    // workers disputando CPU, o import passava dos 30s e o arquivo era
    // reprovado inteiro — sempre por timeout, nunca por asserção, e a cada
    // execução num arquivo diferente. Rodando isolados, os mesmos testes passam
    // em segundos.
    hookTimeout: 60_000,
    // Menos workers deixa cada import respirar. O ganho de paralelismo acima
    // disso é ilusório: os arquivos pesados passam a competir entre si e o tempo
    // total piora junto com a estabilidade.
    //
    // No nível de `test` de propósito: o Vitest 4 removeu `poolOptions`, e a
    // primeira tentativa de ajuste aqui foi silenciosamente ignorada — só um
    // aviso de deprecação no meio da saída denunciava.
    maxWorkers: 8,
    coverage: {
      reporter: ['text', 'html', 'json-summary'],
      exclude: [
        'node_modules',
        'dist',
        'test',
        'e2e',
        'scripts',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      /**
       * Sem `all`, o denominador so continha arquivos que algum teste
       * importou — os 194 arquivos de `src/` que teste nenhum toca ficavam
       * fora da conta e **inflavam o percentual**. O numero passa a doer, e e
       * essa a serventia dele.
       */
      all: true,
      include: ['server/**/*.ts', 'shared/**/*.ts', 'src/**/*.{ts,tsx}'],
    },
  },
});
