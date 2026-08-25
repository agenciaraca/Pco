# Sessão 25/ago/2026 — o projeto mudou de PC

Handoff da migração do repositório para a máquina nova. Nada de produto foi
alterado: só ambiente, ferramental e o material que estava solto.

## O que foi verificado (tudo verde)

| Item | Resultado |
|---|---|
| `main` × `origin/main` | sincronizado, 0 à frente / 0 atrás (era `67547b9`) |
| `feat/public-site` | já mergeada em main, não diverge |
| Node / npm | 24.15.0 / 11.12.1, `node_modules` instalado |
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 180 arquivos, 1714 testes, zero falhas |
| Produção `/api/health` | `{"ok":true,"db":"connected"}` |
| Bundle de produção | `assets/index-IJB2AaMU.js` — igual ao build local do commit `67547b9`, ou seja, **prod está no main, nada pendente de deploy** |

## O que mudou nesta sessão

### 1. `.env` local criado (gitignored)

Não existia `.env` na máquina nova. Criado a partir do `.env.example`, com
tudo que exige credencial real marcado como `PREENCHER` e comentado.
`JWT_SECRET` e `AI_KEY_ENCRYPTION_SECRET` foram gerados aleatoriamente **nesta
máquina** — são de dev, não são os de produção. Nenhuma credencial passou pelo
chat, a pedido do dono.

As credenciais dos dois WordPress da migração continuam no `.env.import`, que
veio junto e também é gitignored.

### 2. Portas do dev agora vêm do `.env`

As portas padrão do projeto estavam **ocupadas por outros projetos desta
máquina** (3001 pelo Next do tarot, 5173 pelo Vite do Sandra). Em vez de editar
arquivo versionado por máquina, `vite.config.ts` passou a ler as portas com
`loadEnv`:

- `PORT` — a mesma variável que `server/dev.ts` já lia. Uma só fonte, então o
  proxy nunca aponta para a porta errada. Default 3001, inalterado.
- `WEB_PORT` — nova, só para o Vite. Default 5173, inalterado.

Nesta máquina o `.env` usa `PORT=3011` e `WEB_PORT=5183`.

### 3. Proxy do Vite: `127.0.0.1`, não `localhost`

O Hono escuta em IPv4. Do Node 17 em diante o DNS não é mais reordenado, então
`localhost` resolve `::1` primeiro no Windows e o proxy morre com
`ECONNREFUSED` **mesmo com a API no ar**. Sintoma: SPA carrega (200), mas
`/api/*` e todas as rotas SSR do site público devolvem 500.

### 4. `npm run dev` ganhou `--raw`

Com concurrently 9.2.1 nesta máquina, o ramo `[api]` morre em silêncio logo
após o banner do npm — sem stack, sem código de erro — e o concurrently derruba
o web junto (exit 1). Medido, não suposto:

| Variante | API sobe? |
|---|---|
| `concurrently -n web,api -c blue,magenta` | não |
| `concurrently -n web,api` (sem cor) | não |
| `concurrently -n api,web` (ordem trocada) | não |
| `concurrently --raw ...` | **sim** |
| `npm run dev:api` sozinho | sim |

Perde-se o prefixo `[web]`/`[api]`, mas as duas pontas já se identificam
sozinhas na saída (`VITE v5.4.21` e `[ava-pco]`). Causa raiz não investigada
até o fim — o que se sabe é que é o encanamento de stdout do concurrently, não
o código do projeto.

Com as quatro correções, o dev completo responde: SPA 200, `/api/health` pelo
proxy 200, SSR `/sobre` 200.

### 5. Material solto entrou no repo

Commit `a00f902`: `AGENTS.md`, `.agents/skills/`, `.codex/`,
`docs/ESPEC-clone-plataforma.md` e o handoff de design das páginas públicas
(`.dc.html` + SEO) — 315 arquivos. Varrido por segredo antes de commitar: só
placeholders (`<your-...>`), nada real. Os ~9 MB vêm quase todos das fontes
`.ttf` da skill canvas-design.

## Pendências abertas — começar por aqui

1. **Hash do bundle mudou e não foi explicado.** Depois de mexer no
   `vite.config.ts`, o build passou a gerar `assets/index-VKqtwYFV.js` em vez
   de `index-IJB2AaMU.js`. A mudança é só de configuração de dev (portas e
   alvo do proxy) e não deveria tocar o bundle — a hipótese é o `.env`, que
   agora existe e é lido pelo Vite (tem `NODE_ENV=development` dentro).
   **Verificar antes do próximo deploy:** buildar com o `.env` fora do lugar e
   comparar o hash. Se o `.env` estiver vazando para o build de produção, tirar
   `NODE_ENV` de lá.
2. **Sem acesso SSH à produção desta máquina.** O `~/.ssh/config` não tem o
   host `vps` e a chave `enlevo_vps195` não está em `~/.ssh/`. Deploy manual e
   qualquer inspeção no servidor estão bloqueados até a chave chegar aqui.
3. **Servidores de outros projetos pararam durante a sessão.** O Next do tarot
   (3001) e o Vite do Sandra (5173) não estão mais no ar. Foram rodados vários
   `Stop-Process` durante o diagnóstico de portas, todos filtrados por porta do
   PCO ou por caminho do PCO — nenhum filtro casa com aqueles dois — mas a
   coincidência é temporal e não dá para afirmar inocência. Basta reiniciar nas
   pastas `C:\ia\dev\tarot` e `C:\ia\dev\Sandra`.

## Onde o dev retoma

A higiene está feita. A frente seguinte continua sendo a do ROADMAP: **Sprint 2
— agendar e pagar sessão** (Onda 8), o único sprint sem trava do dono.
Confirmado no código: existe o catálogo (`GET /sessions/services`,
`/professionals`, `/price-tiers`, `/policy`) e o CRUD admin inteiro, mas **não
existe nenhuma rota de agendamento** — `server/sessions/` só tem
`regra-opcional.ts` e a tela do aluno é estado local que evapora ao recarregar.
