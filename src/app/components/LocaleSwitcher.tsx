import { useLocale, SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from '../i18n';

interface Props {
  variant?: 'select' | 'inline';
  className?: string;
}

export default function LocaleSwitcher({ variant = 'select', className = '' }: Props) {
  const { locale, setLocale } = useLocale();

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-1 ${className}`} role="group">
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              locale === l
                ? 'bg-pco-blue/10 text-pco-blue'
                : 'text-ink-muted hover:bg-surface-off'
            }`}
            title={LOCALE_LABELS[l]}
          >
            <span aria-hidden>{LOCALE_FLAGS[l]}</span>{' '}
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as typeof locale)}
      className={`pco-input text-xs py-1 ${className}`}
      aria-label="Idioma da interface"
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_FLAGS[l]} {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
