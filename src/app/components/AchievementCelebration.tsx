import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { NewAchievementDto } from '../data/api';

export interface AchievementCelebrationProps {
  achievements: NewAchievementDto[];
  onClose: () => void;
}

/**
 * Modal celebratório que aparece quando o aluno desbloqueia uma ou mais
 * conquistas. Auto-fecha em 6s; pode ser fechado manualmente.
 */
export default function AchievementCelebration({
  achievements,
  onClose,
}: AchievementCelebrationProps) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (achievements.length === 0) return;
    const t = setTimeout(() => {
      setClosing(true);
      setTimeout(onClose, 300);
    }, 6000);
    return () => clearTimeout(t);
  }, [achievements, onClose]);

  if (achievements.length === 0) return null;

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 transition-opacity ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={() => {
        setClosing(true);
        setTimeout(onClose, 300);
      }}
    >
      <div
        className="pco-card w-full max-w-md p-6 text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            'linear-gradient(135deg, rgba(255,193,7,0.08), rgba(0,151,178,0.08))',
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 right-2 text-status-gold animate-pulse">
            <Sparkles size={28} />
          </div>
          <div className="absolute bottom-2 left-2 text-pco-blue animate-pulse delay-200">
            <Sparkles size={20} />
          </div>
          <div className="absolute top-12 left-4 text-pco-orange animate-pulse delay-100">
            <Sparkles size={16} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setClosing(true);
            setTimeout(onClose, 300);
          }}
          className="absolute top-2 right-2 p-1 hover:bg-surface-mute rounded z-10"
        >
          <X size={14} />
        </button>

        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-status-gold mb-1">
            🎉 Conquista desbloqueada
          </div>

          {achievements.map((a, i) => (
            <div key={a.badgeId} className={i > 0 ? 'mt-4' : 'mt-2'}>
              <div
                className="text-6xl mb-3 inline-block"
                style={{
                  animation: 'achievementPop 0.6s cubic-bezier(0.5, 1.8, 0.5, 1)',
                }}
              >
                {a.icon}
              </div>
              <h2 className="text-xl font-bold text-pco-deep">{a.title}</h2>
              <p className="text-sm text-ink-muted mt-1">{a.description}</p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setClosing(true);
              setTimeout(onClose, 300);
            }}
            className="pco-btn-primary mt-5 mx-auto"
          >
            Continuar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes achievementPop {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
