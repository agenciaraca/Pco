# Changelog de Design — Site Público PCO (aplicar no projeto AVA)

Atualizações feitas no protótipo desde o handoff original. **Não muda estrutura/rotas** — apenas tema, componentes visuais e conteúdo. Aplicar sobre a implementação existente.

---

## 1. Cores oficiais da marca (tokens)

O acento deixou de ser petróleo `#0f6e66` e passou a ser o **ciano oficial `#0097b2`**. Substituir os valores dos tokens:

### Tema claro
```css
--accent:#0097b2;  --accent-ink:#007a91;  --accent-soft:#d9eef4;  --on-accent:#ffffff;
--brand-deep:#0b7486;   /* ponta escura do degradê da marca */
--brand-orange:#ff914d; --brand-orange-ink:#d96a24; --brand-orange-soft:#ffe9db; --on-orange:#2b1608;
```

### Tema escuro
```css
--accent:#4cc3d9;  --accent-ink:#7fd8e8;  --accent-soft:#102c33;
--brand-deep:#0a5f6e;
--brand-orange:#ff914d; --brand-orange-ink:#ffab77; --brand-orange-soft:#33200f;
```

### Degradê oficial da marca
Sempre **do principal para o escuro**:
```css
background: linear-gradient(118deg, #0097b2 0%, #008ba4 52%, #0b7486 100%);
```
Usar em: hero do AVA, rodapé, seções escuras de destaque. Sombras que eram do teal antigo (`rgba(15,76,92,…)` / `rgba(15,110,102,…)`) viram `rgba(11,116,134,…)` ou `rgba(0,151,178,…)`.

## 2. Papel do laranja `#ff914d`

O laranja é **detalhe de identidade visual**, não cor de marca dominante:
- Estrelas de avaliação (★★★★★)
- Pontinho do badge do hero
- Rótulos de categoria do blog (uppercase pequenos) → `--brand-orange-ink`
- Badge de contagem do carrinho no header
- Links de destaque no rodapé (Política de Privacidade)

## 3. CTAs de matrícula/curso em degradê laranja

Todo CTA primário de conversão (Matricular-se, Quero me matricular, Adicionar, Ir para o checkout, Finalizar e pagar, Entrar no AVA):
```css
background: linear-gradient(118deg, #ff914d, #f07a2f);
color: #fff;
box-shadow: 0 12px 30px rgba(255,145,77,.35);
border-radius: 999px; font-weight: 700;
```
Botões secundários (Ver curso, outline) permanecem no ciano/neutros.

## 4. Botões de WhatsApp

Cor oficial `#25D366`, texto branco, **ícone SVG do WhatsApp** à esquerda (path oficial, fill=currentColor), sombra `0 10px 26px rgba(37,211,102,.35)`. Vale para: heros, CTA final, bloco "Não sabe por onde começar?", botão flutuante e canal na página Contato. Ícone substitui o glifo ✆ antigo.

## 5. Divisor de seção "pincel" (novo componente)

Divisor orgânico em 3 camadas sobrepostas do mesmo tom (opacidades .3/.5/1), curvas longas e assimétricas — dá fluidez e tira o aspecto "quadrado". SVG:

```html
<div style="position:absolute; left:0; right:0; bottom:-1px; line-height:0; pointer-events:none; z-index:2;">
<svg viewBox="0 0 1440 150" preserveAspectRatio="none"
     style="display:block; width:100%; height:clamp(60px,10vw,150px);" fill="COR_DA_PRÓXIMA_SEÇÃO">
  <path opacity=".3" d="M0,70 C320,10 660,120 1020,52 C1210,18 1350,44 1440,72 L1440,151 L0,151 Z"/>
  <path opacity=".5" d="M0,94 C300,44 640,132 1000,80 C1200,52 1350,76 1440,58 L1440,151 L0,151 Z"/>
  <path d="M0,114 C310,72 640,146 1010,100 C1210,76 1350,96 1440,84 L1440,151 L0,151 Z"/>
</svg></div>
```

Onde aplicar (fill = cor de fundo da seção seguinte, ex.: `var(--paper)`):
- **Home:** fim do hero; fim da barra de estatísticas (seção ganha `padding-bottom:120px; position:relative; overflow:hidden`)
- **Curso:** fim do hero (padding-bottom do hero: 130px)
- **Sobre:** fim da barra de números
- **Rodapé:** no TOPO, invertido (`transform: scaleY(-1)`, sem position absolute — inline no fluxo, `line-height:0`)

## 6. Hero da Home

- Fundo: degradê oficial da marca (item 1) como base.
- Foto (`PCO-moderna-psicanalise.png` — consultório moderno) como camada **bem tênue: `opacity: 0.16`**, `background-size: cover; center`.
- Overlay adicional por cima: `linear-gradient(180deg, rgba(11,116,134,.25), rgba(0,151,178,.05) 40%, rgba(11,116,134,.55))`.
- `padding-bottom` do conteúdo: 150px (espaço para o pincel).

## 7. Rodapé — novo layout e conteúdo (todas as páginas)

Fundo: degradê oficial. Pincel invertido no topo. **3 colunas centralizadas** (1fr 1fr 1.3fr; empilha ≤860px):

**Coluna 1** — logo PCO (branca, `filter:brightness(0) invert(1)`), depois:
- WhatsApp (11) 9 8401 0715 e (11) 9 9 71230714 (cada um com ícone e link wa.me)
- falecompco@gmail.com
- separador ondulado (SVG traço branco)
- *Comercial* — Avenida Vital Brasil, n° 305, Butantã / São Paulo-SP CEP 05503-001
- *Coordenação Pedagógica* — Q SHN QUADRA 2 BLOCO A / Brasília – DF CEP 70.702-900
- CNPJ 41.961.134/0001-56

**Coluna 2** — selo RNTP circular (círculo translúcido branco, "RNTP / REGISTRO NACIONAL / DE TERAPEUTAS"), separador ondulado, "RNTP 1407167IE", *Escola Reconhecida RNTP* (itálico).

**Coluna 3** — "Política de Privacidade:" (negrito itálico) + 3 parágrafos verbatim (LGPD), com "Política de Privacidade completa" e "deste link" como links em `--brand-orange`.

Barra final: `© 2018–2026 Psicanálise Clínica Online (PCO). Todos os direitos reservados.`

> O rodapé anterior (4 colunas de navegação) foi substituído por este.

## 8. Página do curso Psicanálise Clínica — conteúdo real

Copy oficial (verbatim, não reescrever) adicionada aos dados do curso `psicanalise-clinica` e renderizada na página entre a grade curricular e o FAQ. Novos campos de dados (ver `data/site.js` do protótipo — fonte da verdade):

- `summary` atualizado: "Com o Curso de Psicanálise Clínica Online da PCO, você aprenderá primeiro sobre psicoterapia…"
- `curriculum`: **15 itens** verbatim (A Ética … Marketing para Psicanalistas; títulos exatos: "As Teorias Pós Freudianas", "O Desenvolvimento Psicossocial", "Direito para Psicanalistas e Terapeutas")
- `highlights[]` (3 cards em `--accent-soft` com nota de asterisco): acesso imediato* / boleto ou cartão* / 4 meses*
- `sections[]` (título + parágrafos + par de CTAs ao final de cada): "Transforme Sua Paixão em Profissão…", "Curso de Psicanálise Clínica Reconhecido pelo RNTP?", "Qual a Grade…?", "Biblioteca Virtual" (+ nota do certificado impresso), "Como funciona… com certificação.", "PCO NEWS" (com subtítulo "Atualização Constante para Profissionais Modernos")
- `jornada[]` (3 cards): "O Despertar da Sua Carreira na Psicanálise" / "A Jornada do Conhecimento" / "A Sua Realização Profissional." — cada um com subtítulo e parágrafo
- `promoNote`: regulamento completo da promoção (small print, antes do aviso de formação livre)
- Par de CTAs em cada seção: botão "QUERO ME MATRICULAR" (degradê laranja) + "Quero Falar No Whatsapp" (verde #25D366 com ícone)

## 9. Contadores da Home (bugfix)

O disparo por IntersectionObserver falhava. Trocar por: listener de scroll + `getBoundingClientRect` (dispara quando `top < innerHeight*1.1`), com interval de 500ms como fallback e resolução do elemento por seletor caso o ref não exista; limpar listeners após disparar.

## 10. Mascote

`assets/`: mascote em 4 poses recortadas (`mascote-acena/joia/aponta/bracos.png`) — Freud cartunizado, fundo bege sólido. Ainda **sem uso definido** no site; sugerido: bloco de ajuda do catálogo, sucesso do checkout, Tutor IA. Aguardando decisão do cliente.

---

### Arquivos-fonte de referência no protótipo
- Tokens/tema: `SiteHeader.dc.html` (bloco `:root` no helmet — importado por todas as páginas)
- Rodapé: `SiteFooter.dc.html`
- Conteúdo do curso: `data/site.js` (entrada `psicanalise-clinica`)
- Pincel aplicado: `Home.dc.html`, `Curso.dc.html`, `Sobre.dc.html`, `SiteFooter.dc.html`
- Hero com foto tênue: `Home.dc.html`
