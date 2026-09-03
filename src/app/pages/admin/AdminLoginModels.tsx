import { Check } from 'lucide-react';
import { useT } from '../../i18n';

const models = [
  {
    id: 'split',
    name: 'Split Screen Premium',
    desc: 'Painel ilustrativo + formulário lado a lado.',
    gradient: 'from-pco-deep via-pco-blue to-pco-cyan',
    selected: true,
  },
  {
    id: 'glass',
    name: 'Glassmorphism PCO',
    desc: 'Vidro fosco sobre imagem de fundo viva.',
    gradient: 'from-pco-cyan via-pco-blue to-pco-deep',
  },
  {
    id: 'hero',
    name: 'Hero Minimal Dark',
    desc: 'Tema escuro minimalista, foco no formulário.',
    gradient: 'from-pco-graphite via-pco-deep to-pco-blue',
  },
  {
    id: 'neural',
    name: 'Neural / IA Modern',
    desc: 'Tema futurista com partículas e gradiente.',
    gradient: 'from-pco-orange via-pco-cyan to-pco-blue',
  },
];

export default function AdminLoginModels() {
  const t = useT();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('admin.nav.loginModels')}</h1>
        <p className="pco-section-subtitle mt-1">
          Escolha um dos 4 modelos disponíveis para a tela de login dos alunos.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {models.map((m) => (
          <button
            key={m.id}
            className={`pco-card pco-card-hover text-left p-0 overflow-hidden ${
              m.selected ? 'ring-2 ring-pco-blue ring-offset-2 ring-offset-surface-off' : ''
            }`}
          >
            <div className={`relative h-40 bg-gradient-to-br ${m.gradient}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.2),transparent_60%)]" />
              {m.selected && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 text-pco-blue text-xs font-semibold px-2 py-0.5">
                  <Check size={10} strokeWidth={3} />
                  Em uso
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="font-semibold text-pco-deep">{m.name}</div>
              <p className="mt-1 text-xs text-ink-muted">{m.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
