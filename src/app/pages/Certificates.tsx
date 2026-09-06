import { Link } from 'react-router-dom';
import { SemConexao, FalhaAoCarregar } from '../components/EstadosDeConsulta';
import { Award, Download, Eye, Copy, ExternalLink } from 'lucide-react';
import { useCertificates, useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';

export default function Certificates() {
  const t = useT();
  const certsQ = useCertificates();
  const certificates = certsQ.data ?? [];
  const coursesQ = useCourses();
  const courses = coursesQ.data ?? [];
  const toast = useToast();

  function copyShareLink(code: string) {
    const url = `${window.location.origin}/verificar/${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link de validação copiado'),
      () => toast.error('Não foi possível copiar'),
    );
  }

  function openCertificate(certId: string) {
    const session = JSON.parse(localStorage.getItem('ava-pco-auth') ?? 'null');
    const token = session?.token;
    void (async () => {
      try {
        const res = await fetch(
          `/api/certificates/${encodeURIComponent(certId)}/render`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok) {
          toast.error('Falha', `HTTP ${res.status}`);
          return;
        }
        const html = await res.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err) {
        toast.error('Falha', err instanceof Error ? err.message : 'Erro');
      }
    })();
  }

  // Sem rede, `isLoading` é falso e a lista sai vazia: a tela dizia "nenhum
  // certificado" para quem tem certificado. Pior aqui do que em outras telas,
  // porque o diploma é a prova de que a pessoa concluiu.
  if (certsQ.fetchStatus === 'paused' || coursesQ.fetchStatus === 'paused')
    return <SemConexao oQue="seus certificados" />;
  if (certsQ.isPending) return <CardListSkeleton count={3} />;
  if (certsQ.isError)
    return (
      <FalhaAoCarregar
        erro={certsQ.error}
        oQue="seus certificados"
        aoTentarDeNovo={() => void certsQ.refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('certificates.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Acompanhe os requisitos e baixe seus certificados ao concluir cada curso.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {certificates.map((cert) => {
          const course = courses.find((c) => c.id === cert.courseId);
          if (!course) return null;
          return (
            <div key={cert.id} className="pco-card pco-card-hover">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-status-gold/15 grid place-items-center">
                    <Award size={22} className="text-status-gold" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                      Certificado
                    </div>
                    <h3 className="text-base font-semibold text-pco-deep">{course.title}</h3>
                  </div>
                </div>
                <span
                  className={`pco-badge ${
                    cert.status === 'in_progress'
                      ? 'bg-pco-blue/10 text-pco-blue'
                      : cert.status === 'available'
                        ? 'bg-pco-orange/10 text-pco-orange'
                        : 'bg-status-success/10 text-status-success'
                  }`}
                >
                  {cert.status === 'in_progress'
                    ? 'Em andamento'
                    : cert.status === 'available'
                      ? 'Disponível'
                      : 'Emitido'}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-ink-muted mb-1">
                  <span>Progresso para emissão</span>
                  <span className="font-semibold text-pco-deep">{cert.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-gray overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-status-gold to-pco-orange transition-all"
                    style={{ width: `${cert.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-surface-off p-3">
                  <div className="text-xs uppercase tracking-wider text-ink-subtle">
                    Carga horária
                  </div>
                  <div className="font-semibold text-pco-deep">{course.totalHours}h</div>
                </div>
                <div className="rounded-lg bg-surface-off p-3">
                  <div className="text-xs uppercase tracking-wider text-ink-subtle">
                    Código de validação
                  </div>
                  <div className="font-mono text-xs font-semibold text-pco-deep">
                    {cert.validationCode}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={cert.status !== 'issued'}
                  onClick={() => openCertificate(cert.id)}
                  className="pco-btn-primary flex-1 justify-center text-xs disabled:opacity-50"
                  title="Abrir certificado (use Cmd+P para salvar como PDF)"
                >
                  <Download size={12} strokeWidth={2} />
                  Baixar / Imprimir
                </button>
                {cert.status === 'issued' && (
                  <>
                    <button
                      type="button"
                      onClick={() => copyShareLink(cert.validationCode)}
                      className="pco-btn-secondary text-xs"
                      title="Copiar link de validação pública"
                    >
                      <Copy size={12} strokeWidth={2} />
                      Compartilhar
                    </button>
                    <Link
                      to={`/verificar/${encodeURIComponent(cert.validationCode)}`}
                      className="pco-btn-ghost text-xs"
                      title="Abrir página pública"
                    >
                      <ExternalLink size={12} strokeWidth={2} />
                    </Link>
                  </>
                )}
                {cert.status !== 'issued' && (
                  <button
                    onClick={() => toast.info('Concluindo', 'Continue completando aulas.')}
                    className="pco-btn-secondary text-xs"
                  >
                    <Eye size={12} strokeWidth={2} />
                    Validar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
