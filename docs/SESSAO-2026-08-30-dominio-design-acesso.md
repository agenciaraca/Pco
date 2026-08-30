# 30 de agosto de 2026 — domínio, design e o portão de acesso

> **Ponto exato de retomada.** Local e `origin/main` em `d355d83`; **produção em
> `4c7c1dc`**, que é o último commit de código — os posteriores são só
> documentação e não precisam de deploy. Nada pendente de commit nem de push.

9 commits. 207 arquivos de teste, **1941 testes**, zero falhas. Lint sem erros.

---

## O achado mais urgente, e ele não é de design

**A PCO não consegue receber um pagamento hoje.**

- **Nenhum dos 7 cursos tem preço.** Todos mostram "Consulte", e a página do
  carro-chefe tem o botão "Matricular-se" sem valor nenhum. Como
  `POST /public/checkout` recusa com `NOT_FOR_SALE` quando não há produto ativo
  ligado ao curso, o site não fecha venda.
- **A loja está fora do ar** em `old.psicanaliseclinica.online`, com 525 — falta
  emitir o certificado dela na origem `72.60.153.234`. A causa exata: a origem
  só apresenta certificado para `psicanaliseclinica.online` e derruba o
  handshake quando a Cloudflare pede o nome `old.`.

Somados, **os dois canais de venda estão parados**. Isso vale mais que qualquer
item de design da lista.

Caminho: `/admin/produtos` → criar produto, definir preço, ligar ao curso. Só o
dono faz. Depois eu confirmo o checkout de ponta a ponta.

---

## O que foi para produção

### Domínio — o AVA assumiu `psicanaliseclinica.online`

O apex já apontava para o servidor do AVA quando entramos; faltava o site e o
certificado no CloudPanel, que o dono criou. Do nosso lado:

- **`PUBLIC_ORIGIN`** definida em produção com o apex, e com backup do `.env`.
- **Redirecionamento canônico**: `ava.` e `www.` respondem 301 para o apex.
  Fica **depois** de `/api/*` de propósito — um 301 num POST faz parte dos
  clientes reenviar como GET e perder o corpo. Conferido antes de escrever que
  o proxy passa o `Host` real de cada nome, senão viraria laço infinito.
- **O endereço saiu de 18 cópias no código** e passou a morar em
  `server/origem-publica.ts`. Treze liam a variável de ambiente; **cinco
  escreviam o domínio direto** — dados estruturados, link de login do e-mail de
  boas-vindas, link do painel no e-mail de progresso, assinatura de todos os
  e-mails e a página de erro. `test/origem-publica.test.ts` varre `server/` e
  falha se o literal reaparecer.

**HSTS perdeu `includeSubDomains`, e isso é temporário.** Servindo o apex, a
diretiva passou a valer para todos os subdomínios — inclusive `old.`, sem
certificado. O efeito é sem escapatória: quem abre o site principal fica um ano
sem conseguir abrir a loja, e o navegador não oferece "continuar assim mesmo".
Foi o que apareceu como "site não seguro". **Religar com
`HSTS_INCLUDE_SUBDOMAINS=true` assim que `old.` tiver certificado.**

### Deploy automático — consertado

Apontava para `srv1621737`, máquina com uma cópia do repo e nenhum processo. Em
vez de acertar a senha do servidor errado, passou a autenticar **por chave** —
a `~/.ssh/pco_deploy`, testada antes: loga como `avapco` no `srv539124`.

Secrets gravados: `VPS_SSH_KEY`, `VPS_HOST=195.200.0.253`, `VPS_USER=avapco`,
`VPS_PORT=22`, `PUBLIC_URL`. **`VPS_PASSWORD` foi removido.**

⚠️ **Ainda não rodou**: a conta do GitHub segue travada por cobrança desde
26/ago. O caminho está correto e testado por SSH, mas a prova final depende
disso ser regularizado.

### Portão de acesso — ninguém entra sem ter comprado

Guardadas as **cinco** portas que emitem sessão: senha, senha com 2FA, Google,
Microsoft e SAML. Um teste conta as chamadas e falha se alguma perder a guarda.

**A regra implementada é "matrícula OU pedido pago", não "só pedido pago".**
Medido com `scripts/medir_impacto_portao.ts` (novo, só lê) contra produção:

```
pedidos pagos (total) ............... 0
pessoas com pedido pago ............. 0
matriculados sem pedido pago ........ 615  (100%)
```

Não existe um único pedido pago no banco — a receita histórica foi cobrada no
WooCommerce/LearnDash. A regra literal trancaria os 615 alunos, sem exceção. A
implementada tem o mesmo efeito para quem chega agora, porque
`grantAccessForOrder` só matricula quando o webhook confirma pagamento.

Para valer a regra estrita, o histórico de pagamentos precisa ser importado
antes. `EXIGIR_MATRICULA_PARA_ENTRAR=false` desliga sem deploy.

### Design — o site deixou de ser dois

O dono apontou o `/ava-pco` como a melhor página e o `/catalogo` como a melhor
lista. Ambos viraram a base.

- **Um cabeçalho só**, no degradê da marca, com a logomarca de verdade. O site
  usava a letra `ψ` num quadradinho enquanto o `/ava-pco` usava o arquivo
  branco — duas identidades no mesmo domínio.
- **Menu com seis destinos**, nesta ordem: **Cursos · Psicanálise Clínica ·
  Nosso AVA · Blog · Sobre · Contato**. Rótulo "Cursos", endereço `/formacoes`
  (a URL tem histórico na busca).
- **Rotas fundidas com 301**: `/catalogo` e `/comparar` → `/formacoes`,
  `/landing` → `/ava-pco`. `/comparar` não tinha um único link apontando para
  ela em todo o produto.
- **A lista de cursos ganhou o desenho do `/catalogo`**: capa com sobreposição,
  etiqueta, título sobre a imagem, contagem de módulos e aulas, preço no
  rodapé. Para isso `modules` e `lessons` subiram do curso completo para o
  resumo — contagem, nunca conteúdo.
- Antes disso, o changelog de design foi aplicado: ciano `#0097b2` no lugar do
  petróleo, degradê da marca, laranja como detalhe, divisor "pincel", foto no
  hero a 16%, WhatsApp com ícone SVG, rodapé com selo RNTP e os dois endereços.

**Dois bugs achados no caminho:** o contador da home nunca disparava
(`IntersectionObserver` com limiar de 40% numa barra que ocupa a tela toda), e
consertá-lo revelou que o ano saía como "2.018".

---

## Correção importante na documentação do projeto

O `CLAUDE.md` afirmava havia três meses que produção tinha **10.205 matrículas
fantasma** e mandava reaplicar a carga v3. Medido em produção:

```
1601 alunos · 615 fichas · 1122 matrículas
```

A carga v3 foi aplicada em 07/jul. **A instrução era perigosa, não só velha:** a
base local está zerada por um reset (3 usuários), e `load_v3_to_divz.ts` marca
como inativo quem não vier na fonte — rodá-la teria derrubado os 1.601. O texto
foi corrigido.

---

## O que continua aberto

### Só o dono destrava

1. **Preço dos cursos** — trava a receita. O mais urgente de tudo.
2. **Certificado de `old.psicanaliseclinica.online`** — a loja está fora do ar.
3. **Cobrança do GitHub** — sem ela, todo deploy segue manual.
4. **Conteúdo do curso** (item 8 do changelog de design): precisa do
   `data/site.js` do protótipo, com o texto verbatim.
5. **Três parágrafos de LGPD** do rodapé — `PRIVACIDADE_RESUMO` está `null` de
   propósito, e a coluna sai do ar enquanto for. Texto jurídico não se inventa.
6. **PNGs do mascote** (item 10).
7. **Descrições dos cursos**: dois têm lixo do scraper do LearnDash
   ("20% Concluído · Expand All Módulos") e quatro repetem o título. Só 2 dos 7
   têm texto de venda.
8. **O laranja divergente**: site público em `#ff914d`, admin e área do aluno em
   `#FE9002`. Um deles tem que ganhar.
9. Profissionais reais em `/admin/analise-supervisao` (zero hoje), `accessMonths`
   por curso, rotação da senha do banco, revisão jurídica, Search Console.

### Depende de liberação de permissão nesta máquina

- **Delta da loja**: `scripts/sync_wc_delta.ts --commit`. Ensaiado — 18 pedidos
  pagos desde 06/jul, **4 contas e 4 matrículas a criar**, 14 já existiam. O
  backup de produção já está feito. A gravação foi barrada pela política de
  permissões. ⚠️ Depende também da loja voltar ao ar: o importador fala com
  `psicanaliseclinica.online`, que agora é o AVA — quando `old.` subir, apontar
  `PSICANALISE_URL` para lá.

### Próximas etapas do plano de design (aprovado)

Etapas 1 a 3 estão feitas. Faltam:

4. **Extrair o sistema visual do `/ava-pco`** — tokens, seção, pílula, cartão,
   selo de ícone e botão como peças compartilhadas. Depois disso, refazer a
   **página do curso**, que é onde a venda acontece.
5. **Costurar a fronteira do login** — mesma marca, mesmo fundo e mesma
   tipografia antes e depois de entrar.

---

## Painéis publicados (mesmas URLs, atualizáveis)

| Painel | Link |
| --- | --- |
| Estado do projeto | https://claude.ai/code/artifact/d7e9cfca-fc6c-44de-91e7-b30766e81508 |
| Plano de domínio | https://claude.ai/code/artifact/0a6e884e-5ee4-494b-9523-89a6ee3014ca |
| Arquitetura do site | https://claude.ai/code/artifact/3ada306b-080e-4fc7-bc28-510110c1606b |

O HTML dos três está versionado em `docs/paineis/`, **para que uma sessão
futura consiga atualizar a mesma URL** — o diretório de rascunho da sessão some
quando a máquina reinicia, o repositório não. Ver `docs/paineis/README.md`.

Documentos entregues ao Claude Design, em `docs/` e copiados para `Downloads/`:
`paginas-para-design.md` e `admin-design-spec.md`.

---

## Como retomar

```bash
cd C:\ia\dev\pco
git log --oneline -1        # deve ser 4c7c1dc
npm run test                # 207 arquivos, 1941 testes
ssh vps 'sudo -u avapco -i curl -s http://127.0.0.1:3035/api/health'
```

O deploy manual é `git push origin main` e depois, no servidor: `git reset
--hard origin/main && npm install --legacy-peer-deps && npm run build && pm2
restart ava-pco --update-env`. O `/api/health` responde 200 com código velho —
quem prova o deploy é o hash do bundle.
