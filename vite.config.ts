import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Portas vêm do .env (gitignored) para que cada máquina resolva conflito com
// outros projetos sem editar arquivo versionado. Sem .env, os defaults são os
// de sempre: 5173 no web, 3001 na API. `PORT` é a mesma variável que
// server/dev.ts lê, então o proxy nunca aponta para a porta errada.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const webPort = Number(env.WEB_PORT || 5173);
  const apiPort = Number(env.PORT || 3001);
  // 127.0.0.1 e não 'localhost': o Hono escuta em IPv4 e o Node 17+ não
  // reordena mais o DNS — 'localhost' resolve ::1 primeiro no Windows e o
  // proxy morre com ECONNREFUSED mesmo com a API no ar.
  const apiTarget = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: webPort,
      open: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        // Site público SSR (server/public/router.ts) — em produção é servido
        // antes do fallback do SPA; no dev o Vite precisa encaminhar essas rotas
        // pro Hono, senão caem no NotFound do React Router.
        // Lista explícita: '/checkout/mock' é rota do SPA (gateway mock) e NÃO
        // pode ser capturada aqui.
        '^/(formacoes|formacao/.+|blog|blog/.+|sobre|autor|contato|llms\.txt|curso-preview/.+|checkout|_pub/.+)$':
          {
            target: apiTarget,
            changeOrigin: true,
          },
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            recharts: ['recharts'],
            query: ['@tanstack/react-query'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
