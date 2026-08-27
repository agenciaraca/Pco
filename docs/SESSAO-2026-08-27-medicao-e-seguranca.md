# 27 de agosto de 2026 — a tela que mentia levou à porta que estava aberta

Onze commits. Começou como continuação da varredura por "telas que mentem" e
terminou em oito problemas de segurança, um deles entregando o produto inteiro
de graça.

O fio condutor não foi planejado: para saber se `/admin/metricas` mostrava
números reais, foi preciso ir ver de onde os dados vinham. Ir ver de onde os
dados vêm é a mesma coisa que perguntar quem pode buscá-los.

---

## Parte 1 — as telas que mentiam

### `/admin/metricas` passou a medir

Era três quartos ficção. Origem do tráfego, páginas mais acessadas,
dispositivos, SEO técnico e as "recomendações de melhoria" eram constantes
escritas à mão dentro do `.tsx`; a série de acessos vinha da semente. A tela
avisava em cima que os números eram de demonstração — o que ajuda, mas não muda
o que um número com cara de medição faz com quem decide. "52% de tráfego
orgânico" vira orçamento de SEO.

Agora o próprio servidor mede. Sem Google Analytics, sem cookie, sem IP: o
navegador manda um sinal por página, o `sessionId` nasce no `sessionStorage` da
aba e nunca vai ao disco, e o que persiste é contador por dia. É essa escolha
que dispensa consentimento de rastreamento — e é ela que precisa ser defendida
se alguém propuser "só mais um campinho".

Daí saem medidos: visitantes, pageviews, rejeição (por dia e por página de
entrada), tempo de sessão, origem, dispositivo, LCP p75 e as rotas em que o SPA
cai no 404.

O que depende do Search Console — posição em busca, volume, CTR — continua sem
fonte, e a tela agora **lista o que não mede** no lugar onde havia mais um
gráfico.

### `/admin/retencao` passou a calcular

Pior que a de métricas, e sem aviso nenhum. Os quatro KPIs eram strings fixas.
A curva de coorte era um array escrito à mão com três cursos que nem são os do
catálogo. E `buildCompletionByCourse` fazia a coisa mais perigosa: pegava os
cursos **reais** e colava em cima os números de uma lista `[64, 52, 71]`.
Rótulo verdadeiro com valor inventado passa por conferência.

Tudo já era calculável — matrícula, progresso, último acesso e risco em
`admin-students`; horas em `watch-time`; e o histórico de e-mails de
reengajamento, que `recordSent` persistia desde sempre e ninguém lia.

Duas sutilezas que mudam o resultado, e não são detalhe:

- **Censura à direita.** Na semana N só entra quem se matriculou há pelo menos
  N semanas. Sem isso, quem entrou ontem contaria como "abandonou na semana 12".
- **Crédito do reengajamento.** Um envio só ganha o retorno se o acesso caiu na
  janela entre ele e o envio seguinte. Sem a janela, quem recebeu três e-mails e
  voltou depois do terceiro creditaria os três — taxa de 100% por construção.

### A regra do denominador

Nasceu aqui e vale para o projeto: **percentual não anda sozinho**. O tipo é
`{ pct: number | null; base: number }` e a tela mostra os dois.

Não é preciosismo. Se produção mostrar "58% de conclusão sobre 10.205
matrículas" num sistema com 785 alunos, o denominador denuncia sozinho o
problema de dados da migração. Um número solto tira de quem olha a chance de
desconfiar.

### Três telas que afirmavam sem ter consultado

**A landing publicava desempenho inventado.** Quatro estatísticas na seção de
retenção — "Retenção 90d 64% (+4pp)", "Conclusão 58%", "Reengajados 48%" — as
mesmas constantes da tela interna. Numa página de venda isso deixa de ser tela
que mente e vira propaganda enganosa (CDC, art. 37): afirmação de resultado a
quem ainda vai decidir comprar. Saíram; no lugar ficou o que o sistema faz de
verdade, cada item apontando para código que existe.

**Números fixos na ficha de um aluno com nome.** "Avaliações 2/8", "Tutor (uso)
12", "POD (plays) 6" — constantes, sob o nome de uma pessoa específica. Um
coordenador podia ligar para alguém achando que ela usou o tutor 12 vezes.

**"Horários disponíveis" que não consultava a agenda.** Oito horários fixos. O
servidor sempre barrou a colisão, então ninguém marcou em cima de ninguém — mas
o aluno escolhia um horário tomado e só descobria no envio.

### E a landing anunciava um cardápio de três anos atrás

Três cursos escritos à mão e um card dizendo "mais formações em breve". O
catálogo tem treze — entre eles Autismo, Neuropsicologia, Psicanálise Forense e
Prevenção ao Suicídio. Não eram cursos "em breve": já existiam, e a página de
venda não os vendia.

### A vitrine tinha duas regras que discordavam

`isPubliclyListed()` tinha um comentário dizendo ser o "ÚNICO portão de
visibilidade pública". Era verdade para o site SSR e o checkout — **não** para o
SPA, que filtrava por "tem produto ativo". Curso marcado `publicListed: false`
sumia do site público e continuava na prateleira do `/catalogo`, mandando quem
clicasse para um checkout que responde 404. A regra mudou de casa para
`shared/visibilidade.ts`, e o teste compara as duas referências por identidade.

### Três provedores de e-mail prontos que a tela não deixava configurar

O registro tem oito; a tela conhecia cinco. Mailgun, Brevo e SES apareciam no
seletor como "mailgun — undefined", e o SMTP como "em breve" — com o provedor
pronto desde sempre. A causa era mais funda que o rótulo: **o formulário só
tinha campo de API key**, e a rota descartava `mailgunDomain` e `sesRegion` em
silêncio. Dava para escolher Mailgun; não dava para configurá-lo, e a falha só
apareceria no primeiro envio — e e-mail que não sai é reset de senha que não
chega.

### A aba de integrações dizia "não conectado" com o Stripe ligado

Cinco nomes com selo fixo escrito à mão. Mentia nos dois sentidos. Agora são
três estados, e a distinção entre os dois últimos é o ponto: **"falta
configurar"** é diferente de **"não existe"** — "não conectado" para o Google
Calendar mandava alguém procurar uma tela que não existe.

Duas regras de classificação que evitam repetir o defeito: gateway `mock` ativo
não conta como conectado (nenhum dinheiro entra), e configuração de IA ativa sem
chave também não — a verificação real pegou duas assim.

---

## Parte 2 — a medição errou para o lado agradável

A primeira versão do beacon esperava 2 segundos para contar a página, para dar
tempo de o LCP existir. O E2E mostrou o estrago no mesmo dia: **de ~20
navegações, duas foram contadas**.

O buraco era o menor dos problemas. Quem sai em menos de dois segundos é
exatamente quem rejeita — a taxa de rejeição sairia mais baixa que a verdade,
fazendo o site parecer melhor do que é. **Medição que erra para o lado agradável
é pior do que nenhuma**: ninguém desconfia de um número que agrada.

Separado em dois sinais — página na hora, desempenho depois — deu 20 de 20.

E aí a medição achou um bug: um 404 em `/aprender/:id`, rota que não existe. O
teste que a visitava tinha como única asserção `expect(page.url()).toContain(...)`
logo depois de um `goto` para essa mesma URL. **Não tem como falhar.** Verde por
não poder ficar vermelho, que é a irmã da suíte verde por não rodar.

---

## Parte 3 — as portas abertas

Investigar de onde vinham os dados levou a perguntar quem pode buscá-los.

### A base de alunos inteira respondia sem token

`GET /api/admin/students` devolvia nome, e-mail, progresso, último acesso e
score de risco de **todos** os alunos para quem pedisse a URL. Em produção,
cerca de duas mil pessoas. Mais quatro rotas de `/admin/` na mesma situação.

**Por que passou:** `attachUser` roda em `app.use('*')` e coloca o usuário no
contexto quando há token — mas não exige. Quem lê o código rápido vê um
middleware global de autenticação onde existe só um de conveniência.

Já havia um teste de guarda, escrito em julho depois de incidente parecido. Ele
cobre uma **amostra** de rotas de escrita — e foi exatamente uma amostra que
deixou estas cinco passarem. O novo percorre `app.routes` e cobra 401 em todas.
Foi verificado ao contrário: removi a proteção de uma rota e confirmei que a
suíte fica vermelha.

### Mais três, fora de `/admin`

- `GET /retention/risks` — nome, score e motivos de cada aluno. Pior que a
  lista de matrícula: é um juízo sobre pessoas nomeadas.
- `POST /ai/tutor` — recurso pago; e sem usuário no contexto a cota caía no id
  do aluno-**semente**, então um anônimo gastava a cota de uma conta real.
- Leitura do fórum — discussão de curso pago, com nome de aluno.

### O material pago inteiro saía no catálogo público

O mais grave. `GET /api/courses` é público — é o catálogo, e precisa ser. Só que
devolvia o curso **inteiro**, e `listCourses()` inclui `lesson.content`.

Um `curl` sem token baixava o HTML completo de todas as aulas de todos os
cursos: em produção, os **2,93 milhões de caracteres** que a migration 0008
recuperou. A apostila pela qual o aluno paga.

A ementa continua pública — é ela que vende. Sai só `content`. E a chave é
**removida**, não esvaziada: `content: ''` faria a tela mostrar a descrição como
se fosse a aula.

O teste que mais importa não é o do vazamento: é o que cobra que o aluno
**matriculado receba** o conteúdo. Sem ele, fechar o vazamento fechando junto o
produto deixaria a suíte verde com nenhum aluno lendo a aula que comprou.

### Autorização: escrever guardado, ler aberto

`DELETE /forum/replies/:id` não verificava nada — qualquer aluno apagava a
resposta de qualquer pessoa. As duas rotas vizinhas sempre checaram autor ou
admin; foi a inconsistência entre vizinhas que deixou passar.

`GET /lessons/:id/comments` não verificava matrícula, enquanto o `POST` ao lado
sempre verificou. `GET /session/:sessionId/transcript` bastava estar logado.

**Fica o padrão para a próxima varredura: par de rotas em que a de escrita tem
guarda e a de leitura não.** Foi a forma de quatro dos oito problemas deste dia,
inclusive o vazamento do material pago.

---

## Números

- **1903 testes** verdes (eram 1833), **E2E 26/26** com `CI=true`
- **11 commits**, todos com typecheck, lint, suíte e build verificados
- 8 problemas de segurança fechados, todos verificados com requisição real
  antes e depois

## O que ficou por fazer

**Só depende do dono:** cadastrar profissionais reais, a grade do curso, trocar
`VPS_HOST`/`VPS_PASSWORD`, rotacionar a senha do banco, revisão jurídica,
credencial do Search Console (é o que falta para as palavras-chave).

**Precisa de produção:** rodar `resolver_duracoes_aulas.ts`, fechar a auditoria
das contas, aplicar o delta da loja, e re-aplicar a migração v3.

**Falta deploy — e agora ele é urgente.** São 36 commits esperando, e entre eles
o fechamento de oito rotas que hoje, em produção, respondem sem token. Enquanto
o deploy não sai, **a base de alunos e o material pago continuam abertos**. A
trava é a chave SSH que não existe nesta máquina; o caminho está em
`docs/deploy.md`.

## Uma coisa que entrou sem intenção

`data/student-progress-email-config.json` foi versionado no commit das
integrações — foi criado por um dos meus servidores de teste antes de eu isolar
o `DATA_DIR`. Ficou porque é consistente com o padrão existente:
`admin-weekly-config.json`, seu irmão, já é versionado com o mesmo formato e
sem segredo. Mas não foi decisão, foi descuido, e fica registrado.
