import { Award, Download, Eye, QrCode } from 'lucide-react';
import { certificates, courses } from '../data/seed';

export default function Certificates() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">Certificados</h1>
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
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
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
                <div className="flex justify-between text-[11px] text-ink-muted mb-1">
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
                  <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
                    Carga horária
                  </div>
                  <div className="font-semibold text-pco-deep">{course.totalHours}h</div>
                </div>
                <div className="rounded-lg bg-surface-off p-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
                    Código de validação
                  </div>
                  <div className="font-mono text-[11px] font-semibold text-pco-deep">
                    {cert.validationCode}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  disabled={cert.status === 'in_progress'}
                  className="pco-btn-primary flex-1 justify-center text-xs"
                >
                  <Download size={12} strokeWidth={2} />
                  Baixar PDF
                </button>
                <button className="pco-btn-secondary text-xs">
                  <Eye size={12} strokeWidth={2} />
                  Validar
                </button>
                <button className="pco-btn-ghost text-xs px-3">
                  <QrCode size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
