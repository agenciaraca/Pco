import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Compass, Sparkles, BookOpen, Heart } from 'lucide-react';
import Logo from '../components/Logo';

const slides = [
  {
    icon: Sparkles,
    title: 'Bem-vindo ao AVA PCO',
    text: 'Seu novo ambiente de aprendizagem da Psicanálise Clínica Online.',
  },
  {
    icon: Compass,
    title: 'Sua Jornada PCO',
    text: 'Trilha visual para acompanhar progresso, módulos, aulas e avaliações.',
  },
  {
    icon: BookOpen,
    title: 'Recursos do AVA',
    text: 'Biblioteca, PCO News, PCO POD, Tutor Virtual e Suporte sempre por perto.',
  },
  {
    icon: Heart,
    title: 'Estude com apoio',
    text: 'Plano de retomada, meta semanal e acompanhamento para você não desistir.',
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const slide = slides[step];
  const Icon = slide.icon;
  const isLast = step === slides.length - 1;

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-surface-off to-pco-cyan/10 px-6">
      <div className="w-full max-w-lg">
        <Logo className="justify-center mb-8" />

        <div className="pco-card p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-pco-blue to-pco-cyan grid place-items-center mb-6 shadow-soft">
            <Icon className="text-white" size={28} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-pco-deep">{slide.title}</h2>
          <p className="mt-2 text-sm text-ink-muted">{slide.text}</p>

          <div className="mt-8 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'bg-pco-blue w-8' : 'bg-surface-gray w-2'}`}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="pco-btn-ghost"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Anterior
            </button>
            {isLast ? (
              <button
                onClick={() => navigate('/termos')}
                className="pco-btn-primary"
              >
                Continuar para Termos
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => Math.min(slides.length - 1, s + 1))}
                className="pco-btn-primary"
              >
                Próximo
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs text-ink-muted hover:text-pco-blue">
            Pular onboarding
          </Link>
        </div>
      </div>
    </div>
  );
}
