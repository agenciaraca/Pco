import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Site público SSR (server/public/router.ts) — em produção é servido
      // antes do fallback do SPA; no dev o Vite precisa encaminhar essas rotas
      // pro Hono, senão caem no NotFound do React Router.
      // Lista explícita: '/checkout/mock' é rota do SPA (gateway mock) e NÃO
      // pode ser capturada aqui.
      '^/(formacoes|formacao/.+|blog|blog/.+|sobre|autor|contato|llms\\.txt|curso-preview/.+|checkout|_pub/.+)$':
        {
          target: 'http://localhost:3001',
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
});
