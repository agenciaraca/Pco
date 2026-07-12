# Prompt de partida — Replicar a área de Blog/Conteúdo (SEO + GEO + E-E-A-T + LLM) em outro projeto

> **Como usar:** cole o bloco abaixo no Claude Code do **projeto-alvo** e anexe os dois
> documentos de referência (`blueprint-blog-seo-geo-eeat.md` e `replicar-area-publicacoes.md`).
> O prompt força a sequência correta — **auditar → gap → implementar por fases** — em vez de
> sair copiando arquivo. Tudo é agnóstico de nicho; o Claude do alvo adapta marca/tema/stack.

---

## Prompt (copie a partir daqui)

```
Quero elevar a área de conteúdo/blog deste projeto ao nível de "referência para
buscas (Google) e para IAs generativas (ChatGPT, Gemini/AI Overviews, Perplexity,
Claude)" — otimização de SEO + GEO + E-E-A-T + citabilidade por LLM.

Use como especificação os dois documentos que estou anexando (são agnósticos de
nicho, vindos de um projeto de referência):
  - blueprint-blog-seo-geo-eeat.md  (7 pilares + plano por fases + código)
  - replicar-area-publicacoes.md    (inventário de arquivos + ordem de reconstrução)

NÃO comece a codar ainda. Siga esta ordem:

1. AUDITORIA: rode o diagnóstico da Seção 1 do blueprint contra ESTE repo.
   Liste, item a item, o que já existe e o que falta (modelo de dados, admin,
   IA, SEO técnico). Foque primeiro no que separa um blog comum de uma
   referência para IA: entidade Author credenciada (separada do User),
   directAnswer/TL;DR, e JSON-LD Article + Person(hasCredential) + FAQPage.

2. GAP + PLANO: monte um plano por fases (Fase 0 dados → 1 SEO técnico público →
   2 autoria credenciada → 3 editor+scores → 4 IA roteável → 5 polimento GEO/LLM).
   Para cada fase, diga o que muda neste repo e o critério de aceite.
   Pare e me mostre o plano antes de implementar.

3. IMPLEMENTAÇÃO: faça UMA fase por vez, com migrações de banco SEMPRE aditivas
   (nunca destrutivas), confirmando comigo entre as fases. Adapte tudo à stack
   real deste projeto — se não for Next.js/Prisma/TipTap, mantenha os CONCEITOS
   (campos do modelo, formato do JSON-LD, prompts, sitemap) e troque a implementação.

4. ADAPTAÇÃO DE NICHO: nada do nicho de origem pode vazar. Ao final, rode
   um grep do vocabulário antigo e troque SITE, publisher (nome/logo) e os
   prompts de IA pelo nicho/marca DESTE projeto.

5. ACEITE: valide contra o checklist final do blueprint (Seção 6) — em especial,
   teste um artigo publicado no Rich Results Test (Article + Person + FAQPage).

Regra de ouro: os MDs são o mapa; o código-fonte deste repo é a verdade. Leia o
arquivo-alvo antes de alterar, e prefira ROI alto/risco baixo primeiro (Fase 1:
o conteúdo que já existe passa a indexar muito melhor sem reescrever nada).
```

---

## Kit de handoff (o que entregar junto)

1. **Este prompt** (acima).
2. `blueprint-blog-seo-geo-eeat.md` — 7 pilares, código de referência, plano por fases.
3. `replicar-area-publicacoes.md` — inventário completo de arquivos + ordem de reconstrução.

## Pontos de nicho a trocar no projeto-alvo (avise o Claude do alvo)

Estão detalhados na Seção 10 do playbook, mas os 2 mais importantes:

- **`article-jsonld.ts`** — constante `SITE` e o `publisher` (nome + logo da Organization).
- **`generate-article/route.ts`** (system prompt) e **`blog-image-style.ts`** (`DEFAULT_IMAGE_STYLE`) —
  hoje carregam tema/paleta do projeto de origem; reescrever para o nicho/marca do alvo.

> Ao final, rodar no projeto-alvo: `grep -ri "<nicho-de-origem>"` para garantir que nada vazou.

---

*Gerado a partir do material de referência da Academia Enlevo. Os caminhos citados nos docs são
do repo de origem — trate-os como mapa; o código do projeto-alvo é a verdade.*
