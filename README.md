# AVA PCO

Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online.

## Stack

- **Vite 5** · **React 18** · **TypeScript 5**
- **Tailwind CSS 3** com paleta PCO custom
- **React Router 6** com lazy-loading por rota
- **TanStack Query** para data layer
- **Recharts** para gráficos (chunk separado)
- **lucide-react** para ícones

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção
npm run preview  # serve o build
```

## Estrutura

```
src/
  main.tsx                  # entrypoint, providers
  styles/theme.css          # tokens, utilitários, paleta PCO
  app/
    routes.tsx              # roteamento + code-splitting + protected routes
    auth/
      AuthContext.tsx       # mock auth (localStorage)
      ProtectedRoute.tsx
    types/schema.ts         # tipos TypeScript do domínio
    data/
      seed.ts               # dados mockados
      api.ts                # camada de API (mock, espelha REST real)
      hooks.ts              # hooks TanStack Query tipados
    layouts/                # StudentLayout, AdminLayout, LearningLayout
    components/             # Sidebar, Topbar, MobileNav, Toast, etc.
    pages/                  # rotas do aluno + LMS + públicas
    pages/admin/            # 23 telas administrativas
```

## Paleta PCO

| Cor | Hex |
|---|---|
| Azul principal | `#0097B2` |
| Ciano | `#0CC0DF` |
| Ciano claro | `#5CE1E6` |
| Laranja destaque | `#FE9002` |
| Azul profundo | `#063B49` |
| Grafite | `#101828` |

## Auth (mock)

O `AuthContext` persiste em `localStorage` e aceita qualquer e-mail.
- E-mail contendo `admin` → role `admin` (acesso a `/admin/*`)
- Outro qualquer → role `student`

Para trocar por backend real, basta substituir a função `login` em
`src/app/auth/AuthContext.tsx` por uma chamada a `/api/auth/login`
e ler/escrever cookie em vez de localStorage.

## Data layer

Toda a página fala com `src/app/data/api.ts`, que hoje retorna dados
mockados com delay simulado. Para conectar ao backend real:

1. Substitua o corpo das funções em `api.ts` por `fetch` para o endpoint.
2. Mantenha as assinaturas — os hooks em `hooks.ts` continuam funcionando.
3. `FAILURE_RATE` em `api.ts` permite simular falhas durante o desenvolvimento.

## Deploy

### Vercel

`vercel.json` está configurado com:
- Framework: Vite
- Output: `dist`
- SPA rewrite (todas as rotas caem em `index.html`)
- Cache imutável para `/assets/*`

Para fazer deploy:
1. Conecte o repo em https://vercel.com/new
2. Selecione o projeto e clique em **Deploy** — os defaults estão corretos

### Outros hosts estáticos

`dist/` após `npm run build` pode ser servido por qualquer host estático,
desde que o servidor faça fallback de 404 para `index.html` (SPA routing).

## CI

GitHub Actions em `.github/workflows/ci.yml`:
- Roda em push e pull request para `main`
- Node 20 + cache npm
- `npm ci` + `npm run build`
- Sobe `dist/` como artifact (7 dias de retenção)

## Próximos passos

1. **Backend real** — substituir `api.ts` por chamadas REST (Hono/Fastify/Next API)
2. **Auth real** — JWT/cookie com refresh token
3. **GA + Search Console reais** — em `/admin/metricas`
4. **Tutor com IA real** — provedor configurável em `/admin/ias`
5. **Database** — Postgres com Prisma/Drizzle (Neon, Supabase ou self-hosted)
