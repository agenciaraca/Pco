import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
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
  TrendingUp,
  Users,
  ScrollText,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Activity,
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
  { icon: TrendingUp, label: 'Plano de retomada', desc: 'Para alunos inativos.' },
];

const cursos = [
  {
    short: 'Psicanálise Clínica',
    full: 'Formação completa em psicanálise contemporânea',
    color: 'from-pco-blue to-pco-cyan',
  },
  {
    short: 'Terapia Familiar Sistêmica',
    full: 'Abordagem sistêmica para famílias e relações',
    color: 'from-pco-cyan to-pco-cyan-light',
  },
  {
    short: 'Hipnoterapia',
    full: 'Hipnose terapêutica com base científica',
    color: 'from-pco-orange to-[#FFB347]',
  },
  {
    short: 'Novos cursos PCO',
    full: 'Mais formações em breve',
    color: 'from-pco-deep to-pco-blue',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-off">
      <SiteHeader />

      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pco-deep via-pco-blue to-pco-cyan" />
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="absolute top-12 -left-12 w-96 h-96 rounded-full bg-pco-cyan-light/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[36rem] h-[36rem] rounded-full bg-pco-orange/30 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-24 lg:py-32 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-6">
            <Sparkles size={14} />
            Nova plataforma de aprendizagem
          </div>
          <h1 className="text-4xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight max-w-3xl">
            AVA PCO: sua formação organizada em uma experiência de aprendizagem moderna.
          </h1>
          <p className="mt-5 text-lg text-white/85 max-w-2xl">
            Cursos, aulas, jornada de estudos, biblioteca, PCO News, PCO POD, Tutor Virtual,
            certificados e acompanhamento em um só ambiente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/onboarding" className="pco-btn-accent">
              Conhecer o AVA PCO
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <a
              href="#recursos"
              className="pco-btn bg-white/15 text-white hover:bg-white/25 backdrop-blur"
            >
              Ver recursos
            </a>
          </div>
        </div>
      </section>

      {/* 2. Posicionamento */}
      <Section>
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-pco-deep">
            Mais do que uma área de aulas. Uma jornada de formação.
          </h2>
          <p className="mt-3 text-ink-muted">
            Estude no seu ritmo, com acompanhamento, retomada e múltiplos formatos de conteúdo.
          </p>
        </div>
      </Section>

      {/* 3. Jornada PCO */}
      <Section bg="off">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <Tag>Jornada PCO</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Trilha visual de aprendizagem
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              Acompanhe módulos, aulas, avaliações, microvitórias e desbloqueios em uma trilha
              adulta — sem mascotes, sem ranking infantil. Foco em progresso real.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink-muted">
              <Bullet>Bloqueios e desbloqueios por progresso</Bullet>
              <Bullet>Próxima ação recomendada sempre visível</Bullet>
              <Bullet>Plano de retomada para inatividade</Bullet>
              <Bullet>Certificado disponível ao final</Bullet>
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
                  <span className="text-sm font-semibold text-pco-deep flex-1">
                    Módulo {m.o}
                  </span>
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
              Concentre-se no que importa
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              Quando você entra em curso, módulo, aula ou avaliação, o AVA muda para um layout
              de estudo dedicado. Sidebar contextual com a trilha, painel de apoio e Modo Foco
              para maximizar vídeo e conteúdo.
            </p>
          </div>
        </div>
      </Section>

      {/* 5. Multi-cursos */}
      <Section bg="off">
        <div className="text-center mb-10">
          <Tag>Multi-cursos</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">Várias formações, um único AVA</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cursos.map((c) => (
            <div key={c.short} className="pco-card pco-card-hover p-0 overflow-hidden">
              <div className={`h-24 bg-gradient-to-br ${c.color}`} />
              <div className="p-5">
                <div className="font-semibold text-pco-deep">{c.short}</div>
                <p className="mt-1 text-xs text-ink-muted">{c.full}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

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
              Apoio pedagógico, no ritmo do aluno
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              IA treinada para responder dúvidas dos cursos da PCO. Limites configuráveis,
              pacotes adicionais externos e escopo claramente delimitado — sempre com aviso de
              que não substitui supervisão clínica ou atendimento profissional.
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
              <ChatBubble role="assistant">
                Boa pergunta. A escuta é a postura ética...
              </ChatBubble>
            </div>
            <div className="mt-3 text-[11px] text-ink-subtle">
              Limite mensal e escopo configurados em /admin/tutor
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
            Áudio, artigos comentados e materiais selecionados — diretamente conectados aos
            seus cursos.
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

      {/* 9. Retenção e acompanhamento */}
      <Section bg="off">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <Tag>Retenção</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Acompanhamento que evita evasão
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              Score de risco por aluno, ações recomendadas, plano de retomada com IA e revisão
              humana. A IA sugere — a equipe pedagógica decide.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBlock label="Retenção 90d" value="64%" delta="+4pp" />
            <StatBlock label="Conclusão" value="58%" delta="+2pp" />
            <StatBlock label="Reengajados" value="48%" delta="+9pp" />
            <StatBlock label="Ritmo (h/sem)" value="2,4" delta="+0,3" />
          </div>
        </div>
      </Section>

      {/* 10. Certificados */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="pco-card p-0 overflow-hidden order-2 lg:order-1">
            <div className="aspect-[1.41] bg-gradient-to-br from-status-gold/10 via-white to-pco-cyan/10 border-y border-status-gold/30 p-8 flex flex-col justify-between">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.3em] text-status-gold font-semibold">
                  Certificado de Conclusão
                </div>
                <div className="mt-2 text-base font-bold text-pco-deep">Psicanálise Clínica</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-ink-muted">Concedido a</div>
                <div className="text-base font-semibold text-pco-deep">[Nome do Aluno]</div>
              </div>
              <div className="flex items-end justify-between text-[10px] text-ink-subtle">
                <span>QR Code</span>
                <span className="font-mono">PCO-XXXX-YYYY</span>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Tag>Certificados</Tag>
            <h2 className="mt-3 text-3xl font-bold text-pco-deep">
              Certificação digital com validação
            </h2>
            <p className="mt-3 text-ink-muted max-w-md">
              QR Code, código de validação único e checklist de requisitos. Reemissão
              controlada e validação aberta para terceiros.
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
            contratados separadamente. Não são obrigatórios para conclusão dos cursos ou
            emissão de certificado.
          </p>
        </div>
      </Section>

      {/* 12. Admin PCO */}
      <Section>
        <div className="text-center mb-10">
          <Tag>Admin PCO</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">
            Controle pedagógico de ponta a ponta
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Activity className="text-pco-blue" size={22} strokeWidth={1.5} />}
            title="Previsão de evasão"
            text="Score por aluno, motivos e ação recomendada."
          />
          <FeatureCard
            icon={<Sparkles className="text-pco-orange" size={22} strokeWidth={1.5} />}
            title="Plano de retomada IA"
            text="Mensagem personalizada, revisão humana, histórico."
          />
          <FeatureCard
            icon={<Layers className="text-pco-deep" size={22} strokeWidth={1.5} />}
            title="Gestão de IAs"
            text="Provedores, modelos, escopo, custo, auditoria."
          />
          <FeatureCard
            icon={<TrendingUp className="text-status-success" size={22} strokeWidth={1.5} />}
            title="Métricas & SEO"
            text="Tráfego, indexação, palavras-chave, dispositivos."
          />
        </div>
      </Section>

      {/* 13. Primeiro acesso */}
      <Section bg="off">
        <div className="text-center mb-10">
          <Tag>Primeiro acesso</Tag>
          <h2 className="mt-3 text-3xl font-bold text-pco-deep">
            Onboarding humano, termos transparentes
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { icon: ShieldCheck, n: 1, t: 'Login' },
            { icon: Compass, n: 2, t: 'Onboarding' },
            { icon: ScrollText, n: 3, t: 'Termos e privacidade' },
            { icon: CheckCircle2, n: 4, t: 'Plano de estudo' },
          ].map((s) => (
            <div key={s.n} className="pco-card text-center">
              <div className="mx-auto h-9 w-9 rounded-xl bg-pco-blue text-white grid place-items-center font-bold text-sm">
                {s.n}
              </div>
              <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-pco-deep">
                <s.icon size={14} className="text-pco-blue" strokeWidth={1.75} />
                {s.t}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 14. CTA final */}
      <Section>
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-pco-deep">Pronto para começar?</h2>
          <p className="mt-3 text-ink-muted">
            Acesse o AVA PCO e comece sua jornada de aprendizagem hoje.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/login" className="pco-btn-primary">
              Entrar no AVA
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <Link to="/onboarding" className="pco-btn-secondary">
              <Users size={14} strokeWidth={2} />
              Primeiro acesso
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

function StatBlock({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="pco-card">
      <div className="text-[11px] uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="mt-1 text-2xl font-bold text-pco-deep">{value}</div>
      <div className="text-[11px] text-status-success font-semibold">{delta}</div>
    </div>
  );
}

function ChatBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-2 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div
        className={`h-7 w-7 rounded-lg shrink-0 grid place-items-center text-[11px] font-semibold ${
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
