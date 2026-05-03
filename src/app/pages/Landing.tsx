import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import Logo from '../components/Logo';

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-off">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-surface-gray">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link to="/login" className="pco-btn-ghost">
              Entrar
            </Link>
            <Link to="/onboarding" className="pco-btn-primary">
              Conhecer o AVA
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </header>

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
            <Link
              to="#recursos"
              className="pco-btn bg-white/15 text-white hover:bg-white/25 backdrop-blur"
            >
              Ver recursos
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-pco-deep">
            Mais do que uma área de aulas. Uma jornada de formação.
          </h2>
          <p className="mt-3 text-ink-muted">
            Estude no seu ritmo, com acompanhamento, retomada e múltiplos formatos de conteúdo.
          </p>
        </div>

        <div id="recursos" className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Compass, label: 'Jornada PCO', desc: 'Trilha visual de aprendizagem.' },
            { icon: GraduationCap, label: 'Multi-cursos', desc: 'Psicanálise, Familiar, Hipno e mais.' },
            { icon: BookOpen, label: 'Biblioteca', desc: 'Apostilas e leituras curadas.' },
            { icon: Newspaper, label: 'PCO News', desc: 'Estudos, artigos e notícias.' },
            { icon: Mic2, label: 'PCO POD', desc: 'Conteúdo em áudio.' },
            { icon: Bot, label: 'Tutor Virtual', desc: 'IA pedagógica de apoio.' },
            { icon: Award, label: 'Certificados', desc: 'Validação digital com QR Code.' },
            { icon: LifeBuoy, label: 'Suporte', desc: 'Plano de retomada e acompanhamento.' },
          ].map((f) => (
            <div key={f.label} className="pco-card pco-card-hover">
              <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center mb-3">
                <f.icon size={18} className="text-pco-blue" strokeWidth={1.75} />
              </div>
              <div className="font-semibold text-pco-deep">{f.label}</div>
              <div className="mt-1 text-xs text-ink-muted">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16">
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
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-pco-deep">Pronto para começar?</h2>
        <p className="mt-3 text-ink-muted max-w-xl mx-auto">
          Acesse o AVA PCO e comece sua jornada de aprendizagem hoje.
        </p>
        <Link to="/login" className="pco-btn-primary mt-6 inline-flex">
          Entrar no AVA
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      </section>

      <footer className="border-t border-surface-gray py-8 text-center text-xs text-ink-subtle">
        © AVA PCO — Ambiente Virtual de Aprendizagem da Psicanálise Clínica Online
      </footer>
    </div>
  );
}
