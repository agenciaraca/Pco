# AVA PCO

Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online.

## Stack

- Vite 5 · React 18 · TypeScript 5
- Tailwind CSS 3
- React Router 6
- Recharts (gráficos)
- lucide-react (ícones)

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
  main.tsx
  styles/theme.css
  app/
    routes.tsx
    types/schema.ts
    data/seed.ts
    layouts/   (StudentLayout, AdminLayout, LearningLayout)
    components/(Sidebar, Topbar, MobileNav, Logo, Placeholder, RootError)
    pages/     (rotas do aluno, públicas, modo LMS)
    pages/admin/ (rotas administrativas)
```

## Paleta PCO

- Azul principal `#0097B2`
- Ciano `#0CC0DF`
- Ciano claro `#5CE1E6`
- Laranja destaque `#FE9002`
- Azul profundo `#063B49`

## Próximos passos

Fase 4–5 da spec: completar páginas admin que ainda são placeholder (CourseEditor,
RecoveryPlan, AnaliseSupervisao admin, LoginCustomize, Settings, etc.) e plugar
backend/API real no lugar dos dados mockados em `src/app/data/seed.ts`.
