import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import { useCourses } from '../data/hooks';
import { isPubliclyListed } from '../../../shared/visibilidade';
import {
  ArrowRight,
  Compass,
  GraduationCap,
  BookOpen,
  Newspaper,
  Mic2,
  Bot,
  Award,
  LifeBuoy,
  Sparkles,
  Stethoscope,
  Maximize2,
  Users,
  ScrollText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

const recursos = [
  { icon: GraduationCap, label: 'Aulas', desc: 'Vídeo, texto e materiais.' },
  { icon: ScrollText, label: 'Avaliações', desc: 'Por módulo, com feedback.' },
  { icon: BookOpen, label: 'Biblioteca', desc: 'Materiais curados.' },
  { icon: Newspaper, label: 'PCO News', desc: 'Estudos e notícias.' },
  { icon: Mic2, label: 'PCO POD', desc: 'Conteúdo em áudio.' },
  { icon: Bot, label: 'Tutor Virtual', desc: 'IA pedagógica.' },
  { icon: Award, label: 'Certificados', desc: 'Validação digital.' },
  { icon: LifeBuoy, label: 'Suporte', desc: 'Acompanhamento humano.' },
];

/**
 * A grade de cores das capas. É a única coisa desta seção que continua fixa —
 * é decoração, não afirmação.
 */
const CAPAS = [
  'from-pco-blue to-pco-cyan',
  'from-pco-cyan to-pco-cyan-light',
  'from-pco-orange to-[#FFB347]',
  'from-pco-deep to-pco-blue',
];

/** Quantos cursos a seção mostra antes de mandar para o catálogo. */
const CURSOS_NA_VITRINE = 8;

export default function Landing() {
  const cursosQ = useCourses();
  // Mesmo portão do site público e do checkout — ver shared/visibilidade.ts.
  const vitrine = (cursosQ.data ?? []).filter(isPubliclyListed).slice(0, CURSOS_NA_VITRINE);

  return (
    <div className="min-h-screen bg-surface-off">
      <SiteHeader />

      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        {/*
          Foto de fundo. É decorativa — quem usa leitor de tela não perde nada
          ao não recebê-la —, então vai com alt vazio e escondida da árvore de
          acessibilidade. O PNG de origem tinha 2,7 MB; as versões WebP em
          `public/img/` pesam 152 KB e 72 KB, e o `srcSet` deixa o celular
          baixar a menor.
        */}
        <img
          src="/img/hero-consultorio.webp"
          srcSet="/img/hero-consultorio-1280.webp 1280w, /img/hero-consultorio.webp 1792w"
          sizes="100vw"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/*
          Overlay a 80%: a foto aparece a 20% e o texto branco mantém contraste.
          É o mesmo gradiente da marca que existia aqui antes — a foto entra por
          baixo dele, não no lugar dele.
        */}
        <div className="absolute inset-0 opacity-80 bg-gradient-to-br from-pco-deep via-pco-blue to-pco-cyan" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay">
          <div className="absolute top-12 -left-12 w-96 h-96 rounded-full bg-pco-cyan-light/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[36rem] h-[36rem] rounded-full bg-pco-orange/30 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-24 lg:py-32 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-6">
            <Sparkles size={14} />
            Ambiente de estudo da Psicanálise Clínica Online
          </div>
          <h1 className="text-4xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight max-w-3xl">
            Estude psicanálise no seu ritmo — com um ambiente feito para você chegar ao fim.
          </h1>
          <p className="mt-5 text-lg text-white/85 max-w-2xl">
            Aulas, trilha de estudo, biblioteca, tutor de dúvidas por IA e certificado com validação
            pública. Tudo em um lugar, no computador ou no celular, 24 horas por dia.
          </p>
          {/*
            O CTA levava a `/onboarding` e a `#recursos`: os dois pressupõem que
            quem lê já comprou. Quem chega aqui pela busca ainda vai decidir, e
            o passo seguinte dele é ver o que existe e quanto custa.

            **Nenhum preço nem parcela nesta página**, de propósito: o teto sai
            de `server/payments/condicoes.ts` e depende do gateway roteado.
            Cravar aqui repetiria o "12x fantasma" -- e a vitrine, que é SSR, já
            calcula e exibe o número certo.
          */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/formacoes" className="pco-btn-accent">
              Ver formações e valores
              <ArrowRight size={14} strokeWidth={2} />
            </a>
            <Link
              to="/login"
              className="pco-btn bg-white/15 text-white hover:bg-white/25 backdrop-blur"
            >
              Já é aluno? Entrar no AVA
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Posicionamento */}
      <Section>
        {/*
          Bloco de resposta direta: as duas primeiras frases definem o que é
          isto, para quem e o que entrega. E o que os buscadores e os
          assistentes extraem de uma página -- por isso vem logo depois do
          hero, em texto corrido, e nao dentro de um card.
        */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-pco-deep">
            Feito para quem estuda com a vida adulta acontecendo ao redor.
          </h2>
          <p className="mt-3 text-ink-muted">
            O AVA PCO é o ambiente de estudo online da Psicanálise Clínica Online: reúne as aulas
            das formações, a trilha de estudo, a biblioteca, o tutor de dúvidas e o certificado num
            único lugar, acessível pelo navegador do computador ou do celular.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<Stethoscope className="text-pco-blue" size={22} strokeWidth={1.5} />}
            title="Quem quer atuar"
            text="Você quer formação séria em psicanálise para atender, e precisa de um caminho claro do primeiro módulo à certificação."
          />
          <FeatureCard
            icon={<Users className="text-pco-cyan" size={22} strokeWidth={1.5} />}
            title="Quem já atende"
            text="Você é psicólogo, terapeuta ou profissional da saúde e quer aprofundar a escuta psicanalítica sem parar a agenda."
          />
          <FeatureCard
            icon={<BookOpen className="text-pco-deep" size={22} strokeWidth={1.5} />}
            title="Quem estuda por si"
            text="Você quer entender Freud, Lacan, Jung e a clínica com profundidade, sem a burocracia de uma faculdade."
          />
        </div>
      </Section>

      {/* 2b. Por que o AVA PCO — os três benefícios */}
      <Section bg="off">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-pco-deep">
            Um ambiente pensado para um problema real: a maioria dos alunos online não termina.
          </h2>
        </div>
        {/*
          É aqui que o acompanhamento de evasão aparece -- e é a única forma
          legítima de ele aparecer nesta página. Havia uma seção "Retenção" com
          "score de risco por aluno", "recalculado a cada 6 horas" e "some se
          ninguém aprovar": linguagem do sistema, dita a quem ainda vai comprar.
          Quem lê não se sente acolhido, sente-se monitorado.

          O mecanismo é o mesmo; o que muda é de que lado ele é contado.
        */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<Compass className="text-pco-blue" size={22} strokeWidth={1.5} />}
            title="Você sempre sabe o próximo passo"
            text="A trilha mostra onde você está, o que falta e qual é a próxima aula. Sem se perder em pastas de vídeo."
          />
          <FeatureCard
            icon={<LifeBuoy className="text-pco-orange" size={22} strokeWidth={1.5} />}
            title="Se a vida atropelar, você retoma"
            text="Ficou semanas fora? O AVA monta um plano de retomada realista e a equipe pedagógica fala com você. Ninguém é abandonado no módulo 2."
          />
          <FeatureCard
            icon={<Bot className="text-pco-cyan" size={22} strokeWidth={1.5} />}
            title="Dúvida às 23h tem resposta"
            text="O Tutor Virtual responde sobre o conteúdo das aulas a qualquer hora; para o que é clínico, você tem gente de verdade."
          />
        </div>
      </Section>

      {/* 3. Jornada PCO */}
      <Section bg="off">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <Tag>Jornada PCO</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Sua formação em uma trilha que mostra progresso de verdade
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              Módulos, aulas e avaliações organizados em sequência. Cada etapa concluída libera a
              próxima; cada avaliação devolve feedback. Você vê a formação inteira em uma tela — e o
              quanto já caminhou.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink-muted">
              <Bullet>Próxima ação sempre visível</Bullet>
              <Bullet>Módulos liberados conforme você avança</Bullet>
              <Bullet>Uma conquista a cada etapa concluída</Bullet>
              <Bullet>Certificado liberado ao cumprir os requisitos</Bullet>
            </ul>
          </div>
          <div className="pco-card p-6">
            <ul className="space-y-3">
              {[
                { o: 1, t: 'Concluído', s: 'completed' },
                { o: 2, t: 'Em andamento', s: 'in_progress' },
                { o: 3, t: 'Disponível', s: 'available' },
                { o: 4, t: 'Bloqueado', s: 'locked' },
              ].map((m) => (
                <li
                  key={m.o}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    m.s === 'locked' ? 'bg-surface-gray opacity-70' : 'bg-surface-off'
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl grid place-items-center font-bold text-sm text-white ${
                      m.s === 'completed'
                        ? 'bg-status-success'
                        : m.s === 'in_progress'
                          ? 'bg-pco-blue'
                          : m.s === 'available'
                            ? 'bg-pco-cyan'
                            : 'bg-ink-subtle'
                    }`}
                  >
                    {m.o}
                  </div>
                  <span className="text-sm font-semibold text-pco-deep flex-1">Módulo {m.o}</span>
                  <span
                    className={`pco-badge ${
                      m.s === 'completed'
                        ? 'bg-status-success/10 text-status-success'
                        : m.s === 'in_progress'
                          ? 'bg-pco-blue/10 text-pco-blue'
                          : m.s === 'available'
                            ? 'bg-pco-cyan/15 text-pco-cyan'
                            : 'bg-surface-gray text-ink-muted'
                    }`}
                  >
                    {m.t}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 4. Modo de estudo em tela cheia */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="pco-card p-0 overflow-hidden order-2 lg:order-1">
            <div className="bg-pco-deep h-64 grid place-items-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(12,192,223,0.2),transparent_60%)]" />
              <div className="relative h-14 w-14 rounded-full bg-white/10 grid place-items-center border-2 border-white/30">
                <Maximize2 size={22} className="text-white" strokeWidth={1.5} />
              </div>
              <span className="absolute bottom-3 left-4 text-white/70 text-xs">
                Modo Foco · Player de aula
              </span>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Tag>Modo de estudo imersivo</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Quando é hora de estudar, a tela some — fica só a aula
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              Ao abrir uma aula, o AVA troca para um layout de estudo: vídeo em destaque, material
              da aula ao lado, trilha à mão e nada de distração. Você continua de onde parou, em
              qualquer aparelho.
            </p>
          </div>
        </div>
      </Section>

      {/* 5. Multi-cursos */}
      {vitrine.length > 0 && (
        <Section bg="off">
          <div className="text-center mb-10">
            <Tag>Formações</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Todas as formações, um só ambiente e um só login
            </h2>
            {/*
              O título NÃO traz o número de formações, e isso é deliberado. O
              plano de conversão pedia "15 formações"; a vitrine pública
              devolve **2** (medido em produção em 10/set/2026). Número de
              catálogo cravado em copy erra no dia em que alguém publica ou
              despublica um curso -- e aqui erraria por treze.

              Quem sabe quantas são é a lista logo abaixo, que vem do catálogo.
            */}
          </div>
          {/*
          Esta grade listava três cursos escritos à mão — "Psicanálise
          Clínica", "Terapia Familiar Sistêmica", "Hipnoterapia" — e um quarto
          card dizendo "Novos cursos PCO / Mais formações em breve". O catálogo
          real tem treze, entre eles Autismo, Neuropsicologia, Psicanálise
          Forense e Prevenção ao Suicídio. Não eram cursos "em breve": já
          existiam, e a página de venda não os vendia.

          Agora vem do catálogo, pelo mesmo portão do site público
          (`isPubliclyListed`). Se a lista não carregar, a seção some — anunciar
          um cardápio antigo é pior do que não anunciar.
        */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {vitrine.map((c, i) => (
              <Link
                key={c.id}
                to={`/curso-preview/${c.id}`}
                className="pco-card pco-card-hover p-0 overflow-hidden block"
              >
                <div
                  className={`h-24 bg-gradient-to-br ${c.coverColor || CAPAS[i % CAPAS.length]}`}
                />
                <div className="p-5">
                  <div className="font-semibold text-pco-deep">{c.shortTitle || c.title}</div>
                  <p className="mt-1 text-xs text-ink-muted line-clamp-2">{c.description}</p>
                </div>
              </Link>
            ))}
          </div>
          {/*
            O botão só aparecia quando havia MAIS de oito cursos -- ou seja,
            nunca, com o catálogo de hoje. E é ele que leva à vitrine, que é
            onde estão o preço e o parcelamento calculados. Numa página de
            venda, o caminho para a compra não pode depender do tamanho do
            catálogo.
          */}
          <div className="mt-8 text-center">
            <a href="/formacoes" className="pco-btn-primary">
              Ver formações e valores
              <ArrowRight size={14} strokeWidth={2} />
            </a>
          </div>
        </Section>
      )}

      {/* 6. Recursos */}
      <Section id="recursos">
        <div className="text-center mb-10">
          <Tag>Recursos do AVA</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">
            Tudo que você precisa para estudar
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {recursos.map((f) => (
            <div key={f.label} className="pco-card pco-card-hover">
              <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center mb-3">
                <f.icon size={18} className="text-pco-blue" strokeWidth={1.75} />
              </div>
              <div className="font-semibold text-pco-deep">{f.label}</div>
              <div className="mt-1 text-xs text-ink-muted">{f.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 7. Tutor Virtual IA */}
      <Section bg="off">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <Tag>Tutor Virtual IA</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Um tutor de dúvidas a qualquer hora, treinado no conteúdo da PCO
            </h2>
            {/*
              "Limites configuráveis, pacotes adicionais externos" descrevia o
              contrato de custo da IA para quem administra. Quem está decidindo
              comprar lê isso como restrição do que vai receber.

              O aviso ético fica -- ele é ativo de confiança, não passivo: uma
              escola de saúde mental que declara o que a IA NÃO faz ganha
              autoridade, não perde.
            */}
            <p className="mt-3 text-ink-muted max-w-md">
              Pergunte sobre a aula, peça um exemplo, reveja um conceito. O Tutor Virtual responde a
              partir do material dos seus cursos — não da internet. Ele não substitui supervisão
              clínica nem atendimento profissional, e diz isso com clareza. Para o que é clínico,
              você tem tutoria humana.
            </p>
          </div>
          <div className="pco-card p-5">
            <div className="space-y-3">
              <ChatBubble role="assistant">
                Posso te ajudar com dúvidas dos seus cursos. Como posso te apoiar?
              </ChatBubble>
              <ChatBubble role="user">
                Qual a diferença entre escuta e técnica em psicanálise?
              </ChatBubble>
              <ChatBubble role="assistant">Boa pergunta. A escuta é a postura ética...</ChatBubble>
            </div>
            <div className="mt-3 text-xs text-ink-subtle">
              Responde sobre o conteúdo das suas aulas — não sobre casos clínicos.
            </div>
          </div>
        </div>
      </Section>

      {/* 8. PCO POD, News e Biblioteca */}
      <Section>
        <div className="text-center mb-10">
          <Tag>Conteúdo curado</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">PCO POD, News e Biblioteca</h2>
          <p className="mt-3 text-ink-muted max-w-xl mx-auto">
            Áudio, artigos comentados e materiais selecionados — diretamente conectados aos seus
            cursos.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard
            icon={<Mic2 className="text-pco-cyan" size={22} strokeWidth={1.5} />}
            title="PCO POD"
            text="Episódios pedagógicos com favoritos, recomendações e episódios por módulo."
          />
          <FeatureCard
            icon={<Newspaper className="text-pco-blue" size={22} strokeWidth={1.5} />}
            title="PCO News"
            text="Estudos, notícias da escola e curadoria de leitura por curso e tema."
          />
          <FeatureCard
            icon={<BookOpen className="text-pco-deep" size={22} strokeWidth={1.5} />}
            title="Biblioteca PCO"
            text="Apostilas, leituras obrigatórias e complementares com filtros por tema."
          />
        </div>
      </Section>

      {/*
        Havia aqui uma seção "Retenção": score de risco por aluno, "recalculado
        a cada 6 horas", "nasce rascunho, some se ninguém aprovar". Tudo
        verdadeiro, e tudo escrito da perspectiva de quem OPERA a escola.

        Numa página que fala com quem ainda vai comprar, isso não vende: quem
        lê se vê vigiado, não acolhido. É a mesma família de defeito que este
        projeto persegue em `/admin` -- tela que fala a linguagem do sistema em
        vez da de quem lê. Ali custava confiança; aqui custa venda.

        O mecanismo não sumiu do produto nem da página: ele virou o benefício
        "Se a vida atropelar, você retoma", lá em cima, contado do lado do
        aluno. Vender o acompanhamento para escolas é outra página, com outro
        público -- e é decisão do dono, não recorte deste arquivo.
      */}

      {/* 10. Certificados */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="pco-card p-0 overflow-hidden order-2 lg:order-1">
            <div className="aspect-[1.41] bg-gradient-to-br from-status-gold/10 via-white to-pco-cyan/10 border-y border-status-gold/30 p-8 flex flex-col justify-between">
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.3em] text-status-gold font-semibold">
                  Certificado de Conclusão
                </div>
                <div className="mt-2 text-base font-bold text-pco-deep">Psicanálise Clínica</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-ink-muted">Concedido a</div>
                <div className="text-base font-semibold text-pco-deep">[Nome do Aluno]</div>
              </div>
              <div className="flex items-end justify-between text-xs text-ink-subtle">
                <span>QR Code</span>
                <span className="font-mono">PCO-XXXX-YYYY</span>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Tag>Certificados</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Certificado digital que qualquer pessoa pode conferir
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              Ao concluir, você recebe um certificado com QR Code e código único. Empregador,
              paciente ou instituição confere a autenticidade em segundos, numa página aberta — sem
              precisar pedir nada à escola.
            </p>
          </div>
        </div>
      </Section>

      {/* 11. Análise e Supervisão opcional */}
      <Section bg="off">
        <div className="pco-card p-10 text-center bg-gradient-to-br from-pco-blue/5 to-pco-cyan/5 border-pco-cyan/20">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-pco-blue/10 grid place-items-center mb-4">
            <Stethoscope className="text-pco-blue" size={22} strokeWidth={1.75} />
          </div>
          <h3 className="text-2xl font-bold text-pco-deep">Análise e Supervisão (opcional)</h3>
          <p className="mt-2 text-sm text-ink-muted max-w-xl mx-auto">
            Análise pessoal, supervisão clínica e orientação formativa são serviços opcionais,
            contratados separadamente. Não são obrigatórios para conclusão dos cursos ou emissão de
            certificado.
          </p>
        </div>
      </Section>

      {/*
        E havia uma seção "Admin PCO" -- previsão de evasão, gestão de IAs,
        métricas e SEO. Zero relevância para quem vai estudar, e o mesmo
        vazamento de bastidor da seção de retenção: "custo", "auditoria",
        "indexação" são palavras de quem administra a plataforma.
      */}

      {/* 13. Primeiro acesso */}
      <Section bg="off">
        <div className="text-center mb-10">
          <Tag>Como funciona</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">
            Da matrícula ao certificado, em 4 passos
          </h2>
        </div>
        {/*
          Os quatro passos eram "Login · Onboarding · Termos e privacidade ·
          Plano de estudo": a sequência que o SISTEMA executa depois que alguém
          já comprou. Quem ainda não comprou precisa saber o que acontece a
          partir do momento em que ele decide -- é isso que reduz a ansiedade
          da compra.

          Nenhum passo cita prazo, parcela ou período de acesso: os três são
          dados que só o dono tem, e o parcelamento é calculado no servidor.
        */}
        <div className="grid gap-3 md:grid-cols-4">
          {[
            {
              icon: Compass,
              n: 1,
              t: 'Escolha a formação',
              d: 'Veja o programa, a carga horária e as formas de pagamento na página do curso.',
            },
            {
              icon: ShieldCheck,
              n: 2,
              t: 'Acesse na hora',
              d: 'Assim que a matrícula é confirmada, o login chega no seu e-mail.',
            },
            {
              icon: GraduationCap,
              n: 3,
              t: 'Estude no seu ritmo',
              d: 'Aulas, avaliações, tutor e biblioteca, no computador ou no celular.',
            },
            {
              icon: CheckCircle2,
              n: 4,
              t: 'Conclua e valide',
              d: 'Certificado digital com QR Code e código de validação pública.',
            },
          ].map((passo) => (
            <div key={passo.n} className="pco-card text-center">
              <div className="mx-auto h-9 w-9 rounded-xl bg-pco-blue text-white grid place-items-center font-bold text-sm">
                {passo.n}
              </div>
              <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-pco-deep">
                <passo.icon size={14} className="text-pco-blue" strokeWidth={1.75} />
                {passo.t}
              </div>
              <p className="mt-2 text-xs text-ink-muted">{passo.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 13b. Perguntas frequentes */}
      <Section>
        <div className="text-center mb-10">
          <Tag>Perguntas frequentes</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">O que costumam perguntar antes</h2>
        </div>
        {/*
          Cada resposta começa pela resposta -- "Sim.", "Não." -- e só depois
          explica. É o que um leitor apressado precisa, e é o formato que
          buscadores e assistentes extraem.

          **Faltam três perguntas do plano, de propósito:** por quanto tempo
          dura o acesso, se há garantia e como pedir reembolso. As três exigem
          dado que só o dono tem, e prazo de acesso tem uma armadilha própria
          (ver "Prazo de acesso" no CLAUDE.md: declarar meses é RETROATIVO, e
          nenhum curso declara hoje). Publicar prazo ou garantia inventados
          numa página que vende formação é problema de CDC, não de copy.

          **E não há JSON-LD de FAQ aqui**, embora o plano peça: esta rota é
          servida como SPA -- o HTML que sai do servidor tem 2,6 kB e nenhum
          texto (medido em produção). Marcação estruturada dentro de JS depende
          de o robô renderizar, e nenhum assistente de IA renderiza. Fazer isso
          direito é mover a página para o SSR, que é decisão à parte.
        */}
        <div className="grid gap-4 md:grid-cols-2">
          <Pergunta q="O AVA PCO funciona no celular?">
            Sim. Funciona no navegador do celular, do tablet e do computador, e pode ser instalado
            na tela inicial como aplicativo.
          </Pergunta>
          <Pergunta q="Preciso estudar em horários fixos?">
            Não. Todo o conteúdo é gravado e liberado conforme você avança; você estuda quando
            puder, e continua de onde parou.
          </Pergunta>
          <Pergunta q="O certificado é reconhecido?">
            É um certificado de formação livre, com validação pública por QR Code. A psicanálise não
            é profissão regulamentada no Brasil: a formação se dá em cursos livres (LDB 9.394/96,
            art. 42) e a ocupação consta na CBO 2515-50 —{' '}
            <a href="/legalidade" className="text-pco-blue-ink underline">
              a página sobre legalidade explica isso em detalhe
            </a>
            .
          </Pergunta>
          <Pergunta q="O Tutor Virtual substitui um professor?">
            Não. Ele tira dúvidas sobre o conteúdo das aulas. Supervisão e questões clínicas são
            tratadas por profissionais.
          </Pergunta>
          <Pergunta q="E se eu parar de estudar por um tempo?">
            Você retoma de onde parou. O AVA monta um plano de retomada e a equipe pedagógica entra
            em contato — ninguém é deixado para trás por ter sumido algumas semanas.
          </Pergunta>
          <Pergunta q="Preciso fazer análise pessoal ou supervisão?">
            Não. São serviços opcionais, contratados à parte, e não são requisito para concluir o
            curso nem para receber o certificado.
          </Pergunta>
        </div>
      </Section>

      {/* 14. CTA final */}
      <Section>
        {/*
          O CTA final era "Entrar no AVA" com "Primeiro acesso" ao lado: as
          duas portas pressupõem conta. Quem chegou até o fim de uma página de
          venda sem ter comprado ficava sem para onde ir.

          A compra vem primeiro; o login continua ali, para quem já é aluno.
        */}
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-pco-deep">
            Sua formação em psicanálise começa com um clique — e termina com um certificado.
          </h2>
          <p className="mt-3 text-ink-muted">
            Escolha a formação, estude no seu ritmo e conclua com certificado de validação pública.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="/formacoes" className="pco-btn-primary">
              Escolher minha formação
              <ArrowRight size={14} strokeWidth={2} />
            </a>
            <Link to="/login" className="pco-btn-secondary">
              <Users size={14} strokeWidth={2} />
              Já sou aluno — entrar
            </Link>
          </div>
        </div>
      </Section>

      <footer className="border-t border-surface-gray py-8 text-center text-xs text-ink-subtle">
        © AVA PCO — Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online
      </footer>
    </div>
  );
}

function Section({
  children,
  bg = 'white',
  id,
}: {
  children: React.ReactNode;
  bg?: 'white' | 'off';
  id?: string;
}) {
  return (
    <section id={id} className={bg === 'off' ? 'bg-white' : 'bg-surface-off'}>
      <div className="max-w-5xl mx-auto px-6 py-16">{children}</div>
    </section>
  );
}

function Pergunta({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="pco-card">
      <h3 className="font-semibold text-pco-deep">{q}</h3>
      <p className="mt-2 text-sm text-ink-muted">{children}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pco-blue/10 text-pco-blue text-xs font-semibold">
      <Sparkles size={12} strokeWidth={2} />
      {children}
    </span>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 size={16} className="text-pco-blue shrink-0 mt-0.5" strokeWidth={1.75} />
      <span>{children}</span>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="pco-card pco-card-hover">
      <div className="h-12 w-12 rounded-2xl bg-surface-off grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-pco-deep">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{text}</p>
    </div>
  );
}

/**
 * Antes exibia número e variação ("64%", "+4pp"). Passou a descrever o que o
 * recurso faz: numa página de venda, número sem medição por trás é afirmação
 * de resultado, e afirmação de resultado tem dono.
 */

function ChatBubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={`flex gap-2 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div
        className={`h-7 w-7 rounded-lg shrink-0 grid place-items-center text-xs font-semibold ${
          role === 'user' ? 'bg-pco-blue text-white' : 'bg-pco-blue/10 text-pco-blue'
        }`}
      >
        {role === 'user' ? 'V' : 'AI'}
      </div>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
          role === 'user' ? 'bg-pco-blue text-white' : 'bg-surface-gray text-pco-deep'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
