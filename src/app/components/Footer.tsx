import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';
import { useSettings, useVersion } from '../data/hooks';

export default function Footer() {
  const { data } = useSettings();
  const { data: ver } = useVersion();
  const year = new Date().getFullYear();
  const siteName = data?.siteName ?? 'AVA PCO';
  const contactEmail = data?.contactEmail;
  const helpEmail = data?.helpEmail;
  const whatsapp = data?.whatsappNumber;
  const termsUrl = data?.termsUrl ?? '/termos';
  const privacyUrl = data?.privacyUrl ?? '/privacidade';

  return (
    <footer className="border-t border-surface-gray bg-white mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <div>
          © {year} {siteName}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center gap-1 hover:text-pco-blue"
            >
              <Mail size={11} strokeWidth={2} />
              {contactEmail}
            </a>
          )}
          {helpEmail && helpEmail !== contactEmail && (
            <a
              href={`mailto:${helpEmail}`}
              className="inline-flex items-center gap-1 hover:text-pco-blue"
            >
              <Mail size={11} strokeWidth={2} />
              {helpEmail}
            </a>
          )}
          {whatsapp && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={11} strokeWidth={2} />
              {whatsapp}
            </span>
          )}
          <Link to={termsUrl} className="hover:text-pco-blue">
            Termos
          </Link>
          <Link to={privacyUrl} className="hover:text-pco-blue">
            Privacidade
          </Link>
          {ver?.version && (
            <span
              className="text-[10px] text-ink-subtle"
              title={`Iniciado em ${ver.startedAt} · ${ver.env}`}
            >
              v{ver.version}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
