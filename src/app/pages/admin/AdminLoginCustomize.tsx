import { useState } from 'react';
import { Save, RotateCcw, Image as ImageIcon, Eye, ArrowRight } from 'lucide-react';

const presets = [
  { name: 'Split Screen Premium', from: '#063B49', via: '#0097B2', to: '#0CC0DF' },
  { name: 'Glassmorphism PCO', from: '#0CC0DF', via: '#0097B2', to: '#063B49' },
  { name: 'Hero Minimal Dark', from: '#101828', via: '#063B49', to: '#0097B2' },
  { name: 'Neural / IA Modern', from: '#FE9002', via: '#0CC0DF', to: '#0097B2' },
];

export default function AdminLoginCustomize() {
  const [title, setTitle] = useState(
    'Sua formação organizada em uma experiência de aprendizagem moderna.',
  );
  const [subtitle, setSubtitle] = useState(
    'Cursos, jornada de estudos, biblioteca, PCO News, PCO POD, Tutor Virtual e certificados em um só ambiente.',
  );
  const [tag, setTag] = useState('Ambiente Virtual de Aprendizagem');
  const [from, setFrom] = useState('#063B49');
  const [via, setVia] = useState('#0097B2');
  const [to, setTo] = useState('#0CC0DF');
  const [position, setPosition] = useState<'left' | 'right'>('right');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const applyPreset = (p: (typeof presets)[number]) => {
    setFrom(p.from);
    setVia(p.via);
    setTo(p.to);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Customizar Login</h1>
          <p className="pco-section-subtitle mt-1">
            Personalize a tela de entrada dos alunos. Pré-visualização ao vivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="pco-btn-secondary text-xs">
            <RotateCcw size={12} strokeWidth={2} />
            Restaurar padrão
          </button>
          <button className="pco-btn-primary text-xs">
            <Save size={12} strokeWidth={2} />
            Salvar customização
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Conteúdo</h3>
            <Field label="Tag superior">
              <input value={tag} onChange={(e) => setTag(e.target.value)} className="pco-input" />
            </Field>
            <Field label="Título principal">
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={3}
                className="pco-input resize-none"
              />
            </Field>
            <Field label="Subtítulo">
              <textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={3}
                className="pco-input resize-none"
              />
            </Field>
          </div>

          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Aparência</h3>

            <div>
              <div className="text-xs font-medium text-ink-muted mb-2">Pré-definidos</div>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="rounded-xl overflow-hidden border border-surface-gray hover:border-pco-blue text-left transition-colors"
                  >
                    <div
                      className="h-12"
                      style={{
                        background: `linear-gradient(135deg, ${p.from}, ${p.via}, ${p.to})`,
                      }}
                    />
                    <div className="px-2 py-1.5 text-[10px] font-medium text-pco-deep">
                      {p.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ColorField label="De" value={from} onChange={setFrom} />
              <ColorField label="Via" value={via} onChange={setVia} />
              <ColorField label="Até" value={to} onChange={setTo} />
            </div>

            <Field label="Posição do formulário">
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as 'left' | 'right')}
                className="pco-input"
              >
                <option value="right">Painel à direita</option>
                <option value="left">Painel à esquerda</option>
              </select>
            </Field>

            <Field label="Tema">
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex-1 pco-btn ${
                    theme === 'light'
                      ? 'bg-pco-blue text-white'
                      : 'bg-white border border-surface-gray text-ink-muted'
                  }`}
                >
                  Claro
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex-1 pco-btn ${
                    theme === 'dark'
                      ? 'bg-pco-deep text-white'
                      : 'bg-white border border-surface-gray text-ink-muted'
                  }`}
                >
                  Escuro
                </button>
              </div>
            </Field>

            <Field label="Imagem de fundo (opcional)">
              <button className="pco-btn-secondary w-full justify-center text-xs">
                <ImageIcon size={12} strokeWidth={2} />
                Enviar imagem
              </button>
            </Field>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3 text-xs text-ink-muted">
            <Eye size={12} strokeWidth={1.75} />
            Pré-visualização ao vivo
          </div>

          <div
            className={`pco-card p-0 overflow-hidden h-[600px] grid grid-cols-1 lg:grid-cols-2 ${
              position === 'left' ? 'lg:grid-flow-col-dense' : ''
            }`}
          >
            <section
              className={`relative overflow-hidden p-8 text-white flex flex-col justify-between ${
                position === 'left' ? 'lg:col-start-2' : ''
              }`}
              style={{
                background: `linear-gradient(135deg, ${from}, ${via}, ${to})`,
              }}
            >
              <div className="absolute inset-0 opacity-30 mix-blend-overlay">
                <div className="absolute top-8 -left-12 w-64 h-64 rounded-full bg-white/30 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-white/15 blur-3xl" />
              </div>
              <div className="relative z-10">
                <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur grid place-items-center font-extrabold text-base">
                  P
                </div>
              </div>
              <div className="relative z-10 space-y-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  {tag}
                </span>
                <h2 className="text-2xl font-extrabold leading-tight">{title}</h2>
                <p className="text-sm text-white/80 max-w-sm">{subtitle}</p>
              </div>
              <div className="relative z-10 text-[10px] text-white/60">© AVA PCO</div>
            </section>

            <section
              className={`flex items-center justify-center p-8 ${
                theme === 'dark' ? 'bg-pco-graphite' : 'bg-white'
              }`}
            >
              <div className="w-full max-w-xs">
                <h3
                  className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-pco-deep'}`}
                >
                  Entrar no AVA
                </h3>
                <p
                  className={`mt-1 text-xs ${theme === 'dark' ? 'text-white/70' : 'text-ink-muted'}`}
                >
                  Bem-vindo de volta. Continue de onde parou.
                </p>
                <div className="mt-6 space-y-3">
                  <input
                    placeholder="seu@email.com"
                    className={`w-full rounded-xl px-3 py-2 text-sm ${
                      theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/40'
                        : 'bg-surface-off border border-surface-gray text-ink-base placeholder:text-ink-subtle'
                    }`}
                  />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className={`w-full rounded-xl px-3 py-2 text-sm ${
                      theme === 'dark'
                        ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/40'
                        : 'bg-surface-off border border-surface-gray text-ink-base placeholder:text-ink-subtle'
                    }`}
                  />
                  <button
                    className="w-full rounded-xl py-2 text-sm font-medium text-white inline-flex items-center justify-center gap-2"
                    style={{ background: from }}
                  >
                    Entrar no AVA PCO
                    <ArrowRight size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-ink-subtle mb-1">{label}</div>
      <div className="flex items-center gap-1.5 rounded-lg border border-surface-gray bg-white px-2 py-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 rounded-md cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-[11px] font-mono text-ink-muted bg-transparent focus:outline-none"
        />
      </div>
    </label>
  );
}
