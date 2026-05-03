import { useState } from 'react';
import {
  Award,
  Plus,
  Search,
  Eye,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Download,
  QrCode,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import { courses, adminStudents, certificates } from '../../data/seed';

const tabs = [
  { id: 'modelos', label: 'Modelos', icon: <Award size={14} strokeWidth={1.75} /> },
  { id: 'emitidos', label: 'Emitidos', icon: <CheckCircle2 size={14} strokeWidth={1.75} /> },
  { id: 'validar', label: 'Validar', icon: <Eye size={14} strokeWidth={1.75} /> },
];

const models = [
  { id: 'm-1', name: 'PCO Padrão', description: 'Modelo padrão para todos os cursos.', active: true },
  { id: 'm-2', name: 'PCO Premium', description: 'Modelo premium dourado para cursos avançados.', active: true },
  { id: 'm-3', name: 'PCO Minimalista', description: 'Layout minimalista alternativo.', active: false },
];

const emitidos = [
  { student: 'Mariana Castro', course: 'c-tfs', issuedAt: '2026-04-30', code: 'PCO-TFS-9X2-AB1' },
  { student: 'Beatriz Lima', course: 'c-psi', issuedAt: '2026-04-22', code: 'PCO-PSI-3KF-7M2' },
  { student: 'Pedro Oliveira', course: 'c-hipno', issuedAt: '2026-04-18', code: 'PCO-HIP-6P9-2X4' },
];

export default function AdminCertificates() {
  const [active, setActive] = useState('modelos');
  const [validateCode, setValidateCode] = useState('');
  const [validation, setValidation] = useState<null | { ok: boolean; cert?: typeof emitidos[number] }>(null);

  const handleValidate = () => {
    const found = emitidos.find((c) => c.code === validateCode.trim().toUpperCase());
    setValidation(found ? { ok: true, cert: found } : { ok: false });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="pco-section-title">Certificados — Admin</h1>
          <p className="pco-section-subtitle mt-1">
            Modelos, certificados emitidos, validação e reemissão.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total emitidos" value="128" />
        <Stat label="Em andamento" value={certificates.length.toString()} />
        <Stat label="Modelos ativos" value={models.filter((m) => m.active).length.toString()} />
        <Stat label="Validações no mês" value="42" accent="green" />
      </div>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'modelos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-pco-deep">
              Modelos de certificado
            </h3>
            <button className="pco-btn-primary text-xs">
              <Plus size={12} strokeWidth={2} />
              Novo modelo
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {models.map((m) => (
              <div key={m.id} className="pco-card pco-card-hover">
                <div className="aspect-[1.41] rounded-xl bg-gradient-to-br from-status-gold/10 via-white to-pco-cyan/10 border border-status-gold/30 p-4 flex flex-col justify-between mb-3">
                  <div className="text-center">
                    <div className="text-[8px] uppercase tracking-[0.3em] text-status-gold font-semibold">
                      Certificado
                    </div>
                  </div>
                  <div className="text-center text-[10px] text-pco-deep font-semibold">
                    {m.name}
                  </div>
                  <div className="flex justify-between text-[8px] text-ink-subtle">
                    <span>QR</span>
                    <span className="font-mono">PCO-XXXX</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-pco-deep">{m.name}</h4>
                  <span
                    className={`pco-badge ${
                      m.active
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-surface-gray text-ink-muted'
                    }`}
                  >
                    {m.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">{m.description}</p>
                <div className="mt-3 flex gap-2">
                  <button className="pco-btn-secondary text-xs flex-1 justify-center">
                    <Edit3 size={12} strokeWidth={1.75} />
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active === 'emitidos' && (
        <div className="space-y-4">
          <div className="pco-card p-3 flex items-center gap-3">
            <Search className="text-ink-subtle" size={14} />
            <input className="pco-input pl-2 border-0" placeholder="Buscar aluno ou código..." />
          </div>
          <div className="pco-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-off">
                  <tr className="text-[11px] uppercase tracking-wider text-ink-subtle">
                    <th className="px-4 py-3 text-left font-medium">Aluno</th>
                    <th className="px-4 py-3 text-left font-medium">Curso</th>
                    <th className="px-4 py-3 text-left font-medium">Emissão</th>
                    <th className="px-4 py-3 text-left font-medium">Código</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {emitidos.map((e, i) => {
                    const c = courses.find((co) => co.id === e.course);
                    return (
                      <tr
                        key={i}
                        className="border-t border-surface-gray hover:bg-surface-off"
                      >
                        <td className="px-4 py-3 font-semibold text-pco-deep">{e.student}</td>
                        <td className="px-4 py-3">
                          <span className="pco-badge bg-pco-blue/10 text-pco-blue">
                            {c?.shortTitle ?? e.course}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-muted text-xs">
                          {new Date(e.issuedAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] text-pco-deep">{e.code}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button className="pco-btn-ghost text-xs px-2.5" title="QR Code">
                              <QrCode size={12} strokeWidth={1.75} />
                            </button>
                            <button className="pco-btn-ghost text-xs px-2.5" title="Baixar">
                              <Download size={12} strokeWidth={1.75} />
                            </button>
                            <button className="pco-btn-ghost text-xs px-2.5" title="Reemitir">
                              <RefreshCw size={12} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {active === 'validar' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="pco-card space-y-4">
            <h3 className="text-base font-semibold text-pco-deep">Validar certificado</h3>
            <p className="text-xs text-ink-muted">
              Insira o código de validação impresso no certificado.
            </p>
            <input
              value={validateCode}
              onChange={(e) => setValidateCode(e.target.value)}
              placeholder="PCO-XXX-XXX-XXX"
              className="pco-input font-mono"
            />
            <button onClick={handleValidate} className="pco-btn-primary w-full justify-center text-xs">
              Validar
            </button>
            {adminStudents && (
              <p className="text-[11px] text-ink-subtle">
                Códigos disponíveis para teste: PCO-TFS-9X2-AB1 · PCO-PSI-3KF-7M2 · PCO-HIP-6P9-2X4
              </p>
            )}
          </div>
          <div className="pco-card">
            <h3 className="text-base font-semibold text-pco-deep mb-3">Resultado</h3>
            {validation === null && (
              <p className="text-sm text-ink-muted text-center py-8">
                Insira um código para validar.
              </p>
            )}
            {validation && validation.ok && validation.cert && (
              <div className="rounded-xl border border-status-success/30 bg-status-success/5 p-4">
                <div className="flex items-center gap-2 text-status-success font-semibold mb-2">
                  <CheckCircle2 size={16} strokeWidth={2} />
                  Certificado válido
                </div>
                <div className="space-y-1 text-sm">
                  <Row label="Aluno" value={validation.cert.student} />
                  <Row
                    label="Curso"
                    value={courses.find((c) => c.id === validation.cert!.course)?.title ?? '—'}
                  />
                  <Row
                    label="Emissão"
                    value={new Date(validation.cert.issuedAt).toLocaleDateString('pt-BR')}
                  />
                  <Row label="Código" value={validation.cert.code} mono />
                </div>
              </div>
            )}
            {validation && !validation.ok && (
              <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4">
                <div className="text-status-danger font-semibold mb-1">Código não encontrado</div>
                <p className="text-xs text-ink-muted">
                  Verifique o código e tente novamente.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'green';
}) {
  return (
    <div className="pco-card">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          accent === 'green' ? 'text-status-success' : 'text-pco-deep'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-semibold text-pco-deep ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}
