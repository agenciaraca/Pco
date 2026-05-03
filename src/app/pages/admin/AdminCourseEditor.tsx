import { useParams, Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Layers,
  BookOpen,
  ScrollText,
  Award,
  Activity,
  Plus,
  GripVertical,
  Edit3,
  Trash2,
  Save,
  Upload,
  Eye,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import { courses } from '../../data/seed';

const tabs = [
  { id: 'geral', label: 'Geral', icon: <FileText size={14} strokeWidth={1.75} /> },
  { id: 'modulos', label: 'Módulos', icon: <Layers size={14} strokeWidth={1.75} /> },
  { id: 'materiais', label: 'Materiais', icon: <BookOpen size={14} strokeWidth={1.75} /> },
  { id: 'avaliacoes', label: 'Avaliações', icon: <ScrollText size={14} strokeWidth={1.75} /> },
  { id: 'certificado', label: 'Certificado', icon: <Award size={14} strokeWidth={1.75} /> },
  { id: 'retencao', label: 'Retenção', icon: <Activity size={14} strokeWidth={1.75} /> },
];

export default function AdminCourseEditor() {
  const { id } = useParams<{ id: string }>();
  const course = courses.find((c) => c.id === id);
  const [active, setActive] = useState('geral');

  if (!course) return <Navigate to="/admin/cursos" replace />;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/cursos"
          className="text-xs font-medium text-pco-blue hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Voltar aos cursos
        </Link>
      </div>

      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${course.coverColor}`} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Editor de curso
            </div>
            <h1 className="text-2xl font-bold text-pco-deep">{course.title}</h1>
            <p className="text-xs text-ink-muted">/{course.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/curso/${course.id}`} className="pco-btn-secondary text-xs">
            <Eye size={12} strokeWidth={2} />
            Pré-visualizar
          </Link>
          <button className="pco-btn-primary text-xs">
            <Save size={12} strokeWidth={2} />
            Salvar alterações
          </button>
        </div>
      </header>

      <Tabs items={tabs} active={active} onChange={setActive} />

      {active === 'geral' && <GeralPane course={course} />}
      {active === 'modulos' && <ModulosPane course={course} />}
      {active === 'materiais' && <MateriaisPane />}
      {active === 'avaliacoes' && <AvaliacoesPane course={course} />}
      {active === 'certificado' && <CertificadoPane course={course} />}
      {active === 'retencao' && <RetencaoPane />}
    </div>
  );
}

function GeralPane({ course }: { course: (typeof courses)[number] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 pco-card space-y-5">
        <Field label="Título do curso">
          <input className="pco-input" defaultValue={course.title} />
        </Field>
        <Field label="Slug (URL)">
          <input className="pco-input font-mono" defaultValue={course.slug} />
        </Field>
        <Field label="Título curto (badges)">
          <input className="pco-input" defaultValue={course.shortTitle} />
        </Field>
        <Field label="Descrição">
          <textarea
            className="pco-input resize-none"
            rows={4}
            defaultValue={course.description}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Carga horária (h)">
            <input type="number" className="pco-input" defaultValue={course.totalHours} />
          </Field>
          <Field label="Status">
            <select className="pco-input">
              <option>Ativo</option>
              <option>Em revisão</option>
              <option>Arquivado</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-5">
        <div className="pco-card">
          <Field label="Capa do curso">
            <div
              className={`h-32 rounded-xl bg-gradient-to-br ${course.coverColor} mb-3`}
            />
            <button className="pco-btn-secondary w-full justify-center text-xs">
              <Upload size={12} strokeWidth={2} />
              Substituir imagem
            </button>
          </Field>
        </div>

        <div className="pco-card text-xs space-y-2">
          <div className="font-semibold text-pco-deep">Resumo</div>
          <Row label="Módulos" value={course.modules.length} />
          <Row label="Aulas" value={course.modules.reduce((s, m) => s + m.lessons.length, 0)} />
          <Row label="Avaliações" value={course.modules.filter((m) => m.assessment).length} />
          <Row label="Certificado" value={course.certificateAvailable ? 'Sim' : 'Não'} />
        </div>
      </div>
    </div>
  );
}

function ModulosPane({ course }: { course: (typeof courses)[number] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pco-deep">
          Módulos · {course.modules.length}
        </h3>
        <button className="pco-btn-primary text-xs">
          <Plus size={12} strokeWidth={2} />
          Novo módulo
        </button>
      </div>

      <ul className="space-y-2">
        {course.modules.map((module, i) => (
          <li
            key={module.id}
            className="pco-card flex items-center gap-3 p-4"
          >
            <button className="text-ink-subtle hover:text-pco-deep cursor-grab" aria-label="Arrastar">
              <GripVertical size={16} strokeWidth={1.75} />
            </button>
            <div className="h-8 w-8 rounded-lg bg-pco-blue/10 grid place-items-center text-xs font-bold text-pco-blue shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-pco-deep">{module.title}</div>
              <div className="text-[11px] text-ink-subtle">
                {module.lessons.length} aulas · {module.assessment ? '1 avaliação' : 'sem avaliação'}
              </div>
            </div>
            <button className="pco-btn-ghost text-xs px-2.5">
              <Edit3 size={12} strokeWidth={1.75} />
            </button>
            <button className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10">
              <Trash2 size={12} strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MateriaisPane() {
  return (
    <div className="pco-card text-center py-10">
      <p className="text-sm text-ink-muted">
        Vincule materiais da Biblioteca PCO a este curso.
      </p>
      <button className="mt-4 pco-btn-primary text-xs">
        <Plus size={12} strokeWidth={2} />
        Vincular material
      </button>
    </div>
  );
}

function AvaliacoesPane({ course }: { course: (typeof courses)[number] }) {
  const assessments = course.modules.filter((m) => m.assessment);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pco-deep">
          Avaliações · {assessments.length}
        </h3>
        <button className="pco-btn-secondary text-xs">
          <Plus size={12} strokeWidth={2} />
          Nova avaliação
        </button>
      </div>
      {assessments.map((m) => (
        <div key={m.id} className="pco-card flex items-center gap-3">
          <ScrollText size={16} className="text-pco-orange" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-pco-deep">{m.assessment?.title}</div>
            <div className="text-[11px] text-ink-subtle">
              {m.assessment?.questionCount} questões · aprovação {m.assessment?.passingScore}%
            </div>
          </div>
          <button className="pco-btn-ghost text-xs">
            <Edit3 size={12} strokeWidth={1.75} />
            Editar
          </button>
        </div>
      ))}
    </div>
  );
}

function CertificadoPane({ course }: { course: (typeof courses)[number] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="pco-card space-y-4">
        <h3 className="text-base font-semibold text-pco-deep">Configuração</h3>
        <Field label="Emissão de certificado">
          <select className="pco-input" defaultValue={course.certificateAvailable ? 'sim' : 'nao'}>
            <option value="sim">Habilitada</option>
            <option value="nao">Desabilitada</option>
          </select>
        </Field>
        <Field label="Carga horária do certificado">
          <input type="number" className="pco-input" defaultValue={course.totalHours} />
        </Field>
        <Field label="Modelo de certificado">
          <select className="pco-input">
            <option>Modelo PCO Padrão</option>
            <option>Modelo PCO Premium</option>
          </select>
        </Field>
        <Field label="Requisitos de conclusão">
          <div className="space-y-2 text-sm">
            <Check label="Concluir todas as aulas obrigatórias" defaultChecked />
            <Check label="Aprovação em todas as avaliações" defaultChecked />
            <Check label="Aceite dos termos do certificado" />
          </div>
        </Field>
      </div>

      <div className="pco-card">
        <h3 className="text-base font-semibold text-pco-deep mb-3">Pré-visualização</h3>
        <div className="aspect-[1.41] rounded-xl bg-gradient-to-br from-status-gold/10 via-white to-pco-cyan/10 border border-status-gold/30 p-6 flex flex-col justify-between">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-status-gold font-semibold">
              Certificado de Conclusão
            </div>
            <div className="mt-2 text-lg font-bold text-pco-deep">{course.title}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-ink-muted">Concedido a</div>
            <div className="text-base font-semibold text-pco-deep">[Nome do Aluno]</div>
            <div className="mt-1 text-[10px] text-ink-subtle">
              Carga horária: {course.totalHours}h
            </div>
          </div>
          <div className="flex items-end justify-between text-[10px] text-ink-subtle">
            <span>QR Code</span>
            <span className="font-mono">PCO-XXXX-YYYY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetencaoPane() {
  return (
    <div className="pco-card space-y-5">
      <h3 className="text-base font-semibold text-pco-deep">Regras de retenção</h3>
      <Field label="Liberação de módulos">
        <select className="pco-input">
          <option>Liberar todos imediatamente</option>
          <option>Liberar semanalmente</option>
          <option>Liberar conforme conclusão do anterior</option>
        </select>
      </Field>
      <Field label="Janela de inatividade para alerta (dias)">
        <input type="number" className="pco-input" defaultValue={7} />
      </Field>
      <Field label="Janela para plano de retomada (dias)">
        <input type="number" className="pco-input" defaultValue={14} />
      </Field>
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

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-pco-deep">{value}</span>
    </div>
  );
}

function Check({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
      />
      <span>{label}</span>
    </label>
  );
}
