import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Compass, Sparkles, BookOpen, Heart } from 'lucide-react';
import Logo from '../components/Logo';
import { useT } from '../i18n';

export default function Onboarding() {
  const t = useT();
  const slides = [
    { icon: Sparkles, title: t('onboarding.welcome'), text: t('onboarding.welcomeText') },
    { icon: Compass, title: t('onboarding.journey'), text: t('onboarding.journeyText') },
    { icon: BookOpen, title: t('onboarding.resources'), text: t('onboarding.resourcesText') },
    { icon: Heart, title: t('onboarding.support'), text: t('onboarding.supportText') },
  ];
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
              {t('common.previous')}
            </button>
            {isLast ? (
              <button
                onClick={() => navigate('/termos')}
                className="pco-btn-primary"
              >
                {t('onboarding.continueToTerms')}
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => Math.min(slides.length - 1, s + 1))}
                className="pco-btn-primary"
              >
                {t('common.next')}
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-xs text-ink-muted hover:text-pco-blue">
            {t('onboarding.skip')}
          </Link>
        </div>
      </div>
    </div>
  );
}
