import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';
import Logo from '../components/Logo';
import { validateCertificate } from '../data/api';
import type { Certificate } from '../types/schema';

export default function VerifyCertificate() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ valid: boolean; cert?: Certificate } | null>(null);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    validateCertificate(code).then((r) => {
      setResult({ valid: r.valid, cert: r.certificate });
      setLoading(false);
    });
  }, [code]);

  return (
    <div className="min-h-screen bg-surface-off">
      <header className="border-b border-surface-gray bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Link
            to="/"
            className="text-xs text-pco-blue hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="pco-card p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-pco-deep">Verificação de Certificado</h1>
            <p className="text-sm text-ink-muted mt-1">
              Código informado:{' '}
              <code className="font-mono text-pco-deep">{code ?? '—'}</code>
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-ink-muted">
              <Loader2 size={18} className="animate-spin" />
              <span>Verificando...</span>
            </div>
          ) : result?.valid && result.cert ? (
            <div className="rounded-2xl border border-status-success/30 bg-status-success/5 p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-status-success/15 grid place-items-center mb-3">
                <CheckCircle2 className="text-status-success" size={28} strokeWidth={2} />
              </div>
              <h2 className="text-xl font-bold text-status-success">Certificado válido</h2>
              <p className="text-sm text-ink-muted mt-1">
                Este certificado foi emitido pela PCO e consta no nosso registro oficial.
              </p>
              <div className="mt-6 grid gap-2 text-left max-w-sm mx-auto">
                <DetailRow label="Código" value={result.cert.validationCode} mono />
                <DetailRow
                  label="Emissão"
                  value={
                    result.cert.issuedAt
                      ? new Date(result.cert.issuedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'
                  }
                />
                <DetailRow label="Curso (id)" value={result.cert.courseId} />
                <DetailRow label="Aluno (id)" value={result.cert.studentId} />
                <DetailRow
                  label="Status"
                  value={result.cert.status === 'issued' ? 'Emitido' : result.cert.status}
                />
              </div>
              <Link
                to="/"
                className="mt-6 inline-flex items-center gap-1 text-xs text-pco-blue hover:underline"
              >
                <ExternalLink size={11} strokeWidth={2} />
                Conhecer a PCO
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-status-danger/30 bg-status-danger/5 p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-status-danger/15 grid place-items-center mb-3">
                <XCircle className="text-status-danger" size={28} strokeWidth={2} />
              </div>
              <h2 className="text-xl font-bold text-status-danger">Código não encontrado</h2>
              <p className="text-sm text-ink-muted mt-2 max-w-sm mx-auto">
                Não localizamos um certificado com este código. Verifique se digitou
                corretamente. Caso o problema persista, entre em contato com a PCO.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-surface-gray/50 pb-1 last:border-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span
        className={`text-sm font-semibold text-pco-deep ${mono ? 'font-mono' : ''} text-right`}
      >
        {value}
      </span>
    </div>
  );
}
