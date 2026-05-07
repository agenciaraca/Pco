import { useParams, Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  FileText,
  Layers,
  BookOpen,
  ScrollText,
  Award,
  Activity,
  Plus,
  Edit3,
  Trash2,
  Save,
  Upload,
  Eye,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  X,
  Video,
} from 'lucide-react';
import Tabs from '../../components/Tabs';
import {
  useCourse,
  useCourses,
  useUpdateCourse,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useUpsertAssessment,
  useDeleteAssessment,
} from '../../data/hooks';
import { PageLoadingSkeleton } from '../../components/LoadingSkeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import {
  updateCourseSchema,
  type UpdateCourseInput,
  createModuleSchema,
  type CreateModuleInput,
  createLessonSchema,
  type CreateLessonInput,
  createAssessmentSchema,
  type CreateAssessmentInput,
} from '../../../../shared/schemas';
import type { Course, Module, Lesson, Assessment } from '../../types/schema';

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
  const courseQ = useCourse(id);
  const [active, setActive] = useState('geral');

  if (courseQ.isLoading) return <PageLoadingSkeleton />;
  if (!courseQ.data) return <Navigate to="/admin/cursos" replace />;

  const course = courseQ.data;

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
          <Link
            to={`/admin/cursos/${course.id}/analytics`}
            className="pco-btn-ghost text-xs"
            title="Analytics consolidado"
          >
            <BarChart3 size={12} strokeWidth={2} />
            Analytics
          </Link>
          <Link
            to={`/admin/cursos/${course.id}/preview`}
            className="pco-btn-secondary text-xs"
            title="Renderiza como aluno (sem afetar progresso real)"
          >
            <Eye size={12} strokeWidth={2} />
            Preview como aluno
          </Link>
          <Link
            to={`/admin/cursos/${course.id}/questoes`}
            className="pco-btn-ghost text-xs"
            title="Banco de questões reutilizáveis pra avaliações"
          >
            <FileText size={12} strokeWidth={2} />
            Banco de questões
          </Link>
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

function GeralPane({ course }: { course: Course }) {
  const toast = useToast();
  const update = useUpdateCourse();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<UpdateCourseInput>({
    resolver: zodResolver(updateCourseSchema),
    defaultValues: {
      title: course.title,
      slug: course.slug,
      shortTitle: course.shortTitle,
      description: course.description,
      totalHours: course.totalHours,
      certificateAvailable: course.certificateAvailable,
      coverColor: course.coverColor,
      instructorName: course.instructorName ?? '',
      instructorBio: course.instructorBio ?? '',
      instructorPhotoUrl: course.instructorPhotoUrl ?? '',
      certificateTemplate: {
        title: course.certificateTemplate?.title ?? '',
        preamble: course.certificateTemplate?.preamble ?? '',
        bodyText: course.certificateTemplate?.bodyText ?? '',
        accentColor: course.certificateTemplate?.accentColor ?? '',
        ribbonColor: course.certificateTemplate?.ribbonColor ?? '',
        orgName: course.certificateTemplate?.orgName ?? '',
        signatureName: course.certificateTemplate?.signatureName ?? '',
        signatureRole: course.certificateTemplate?.signatureRole ?? '',
        logoUrl: course.certificateTemplate?.logoUrl ?? '',
      },
    },
  });

  const [tags, setTags] = useState<string[]>(course.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [prereqIds, setPrereqIds] = useState<string[]>(
    course.prerequisiteCourseIds ?? [],
  );
  const [outcomes, setOutcomes] = useState<string[]>(
    course.learningOutcomes ?? [],
  );
  const [outcomeInput, setOutcomeInput] = useState('');
  const [collaborators, setCollaborators] = useState<
    Array<{ name: string; role?: string; bio?: string; photoUrl?: string }>
  >(course.collaborators ?? []);

  function addCollaborator() {
    if (collaborators.length >= 10) return;
    setCollaborators([...collaborators, { name: '' }]);
  }

  function updateCollaborator(
    idx: number,
    field: 'name' | 'role' | 'bio' | 'photoUrl',
    value: string,
  ) {
    setCollaborators(
      collaborators.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  }

  function removeCollaborator(idx: number) {
    setCollaborators(collaborators.filter((_, i) => i !== idx));
  }
  const allCoursesQ = useCourses();
  const otherCourses = (allCoursesQ.data ?? []).filter((c) => c.id !== course.id);

  function addOutcome() {
    const v = outcomeInput.trim();
    if (!v || outcomes.includes(v) || outcomes.length >= 20) return;
    setOutcomes([...outcomes, v]);
    setOutcomeInput('');
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v) || tags.length >= 20) return;
    setTags([...tags, v]);
    setTagInput('');
  }

  function togglePrereq(id: string) {
    setPrereqIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const onSubmit = async (data: UpdateCourseInput) => {
    try {
      // Limpa campos vazios do certificateTemplate antes de enviar
      const tplRaw = data.certificateTemplate ?? {};
      const tplCleaned: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(tplRaw)) {
        if (typeof v === 'string' && v.trim() !== '') tplCleaned[k] = v.trim();
      }
      const certificateTemplate =
        Object.keys(tplCleaned).length > 0 ? tplCleaned : undefined;

      // Limpa colaboradores: remove vazios + descarta campos vazios
      const cleanCollabs = collaborators
        .filter((c) => c.name.trim().length >= 2)
        .map((c) => ({
          name: c.name.trim(),
          ...(c.role?.trim() ? { role: c.role.trim() } : {}),
          ...(c.bio?.trim() ? { bio: c.bio.trim() } : {}),
          ...(c.photoUrl?.trim() ? { photoUrl: c.photoUrl.trim() } : {}),
        }));

      const updated = await update.mutateAsync({
        id: course.id,
        patch: {
          ...data,
          tags,
          prerequisiteCourseIds: prereqIds,
          learningOutcomes: outcomes,
          certificateTemplate,
          collaborators: cleanCollabs.length > 0 ? cleanCollabs : undefined,
        },
      });
      toast.success('Curso atualizado', updated.title);
      reset({
        title: updated.title,
        slug: updated.slug,
        shortTitle: updated.shortTitle,
        description: updated.description,
        totalHours: updated.totalHours,
        certificateAvailable: updated.certificateAvailable,
        coverColor: updated.coverColor,
      });
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 pco-card space-y-5">
        <Field label="Título do curso" error={errors.title?.message}>
          <input {...register('title')} className="pco-input" />
        </Field>
        <Field label="Slug (URL)" error={errors.slug?.message}>
          <input {...register('slug')} className="pco-input font-mono" />
        </Field>
        <Field label="Título curto (badges)" error={errors.shortTitle?.message}>
          <input {...register('shortTitle')} className="pco-input" />
        </Field>
        <Field label="Descrição" error={errors.description?.message}>
          <textarea {...register('description')} className="pco-input resize-none" rows={4} />
        </Field>
        <Field label="Tags / categorias">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="pco-badge bg-pco-blue/10 text-pco-blue inline-flex items-center gap-1"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="hover:text-status-danger"
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-ink-subtle">Nenhuma tag</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="pco-input flex-1"
              placeholder="Nova tag e Enter (ex: introdutório)"
              maxLength={40}
            />
            <button
              type="button"
              onClick={addTag}
              className="pco-btn-ghost text-xs"
              disabled={!tagInput.trim() || tags.length >= 20}
            >
              Adicionar
            </button>
          </div>
        </Field>

        <Field label="Pré-requisitos (cursos que devem estar concluídos)">
          {otherCourses.length === 0 ? (
            <p className="text-xs text-ink-subtle">
              Nenhum outro curso disponível.
            </p>
          ) : (
            <>
              <div className="grid gap-1 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1 border border-pco-border rounded-lg p-2">
                {otherCourses.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-surface-mute cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={prereqIds.includes(c.id)}
                      onChange={() => togglePrereq(c.id)}
                      className="accent-pco-blue mt-0.5"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-ink-strong">{c.title}</span>
                      <code className="text-[10px] text-ink-subtle">{c.slug}</code>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-ink-subtle mt-2">
                {prereqIds.length === 0
                  ? 'Sem pré-requisitos: aluno pode se matricular livremente.'
                  : `${prereqIds.length} curso(s) selecionado(s). Aluno verá um aviso ao tentar acessar este curso sem completar todos.`}
              </p>
            </>
          )}
        </Field>

        <Field label="O que você vai aprender (bullets)">
          <ul className="space-y-1 mb-2">
            {outcomes.map((o, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm bg-surface-off rounded-lg p-2"
              >
                <span className="text-pco-blue text-base leading-tight">•</span>
                <span className="flex-1 text-ink-strong">{o}</span>
                <button
                  type="button"
                  onClick={() =>
                    setOutcomes(outcomes.filter((_, i) => i !== idx))
                  }
                  className="text-status-danger hover:text-status-danger/70 text-xs"
                  title="Remover"
                >
                  ×
                </button>
              </li>
            ))}
            {outcomes.length === 0 && (
              <li className="text-xs text-ink-subtle">Nenhum bullet adicionado.</li>
            )}
          </ul>
          <div className="flex gap-2">
            <input
              value={outcomeInput}
              onChange={(e) => setOutcomeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOutcome();
                }
              }}
              className="pco-input flex-1"
              placeholder="Ex: Compreender os fundamentos do inconsciente"
              maxLength={200}
            />
            <button
              type="button"
              onClick={addOutcome}
              className="pco-btn-ghost text-xs"
              disabled={!outcomeInput.trim() || outcomes.length >= 20}
            >
              Adicionar
            </button>
          </div>
          <p className="text-[11px] text-ink-subtle mt-2">
            Aparece como destaque na página pública do curso. Recomendamos
            entre 4 e 8 bullets focados em resultados ("Vou conseguir
            X", "Vou entender Y").
          </p>
        </Field>

        <fieldset className="border border-pco-border rounded-lg p-4 space-y-3">
          <legend className="px-2 text-xs font-semibold text-pco-deep">
            Certificado — customização (opcional)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título do certificado">
              <input
                {...register('certificateTemplate.title')}
                className="pco-input"
                placeholder="Certificado de Conclusão"
                maxLength={120}
              />
            </Field>
            <Field label="Preâmbulo">
              <input
                {...register('certificateTemplate.preamble')}
                className="pco-input"
                placeholder="Certificamos que"
                maxLength={200}
              />
            </Field>
          </div>
          <Field label="Corpo (suporta {{course}} e {{hours}})">
            <textarea
              {...register('certificateTemplate.bodyText')}
              rows={2}
              className="pco-input resize-none text-sm"
              placeholder="concluiu com aproveitamento o curso {{course}} ({{hours}})"
              maxLength={500}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cor primária (#RRGGBB)">
              <input
                {...register('certificateTemplate.accentColor')}
                className="pco-input font-mono text-xs"
                placeholder="#0097B2"
              />
            </Field>
            <Field label="Cor da fita decorativa (#RRGGBB)">
              <input
                {...register('certificateTemplate.ribbonColor')}
                className="pco-input font-mono text-xs"
                placeholder="#FE9002"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Logo URL (opcional)">
              <input
                {...register('certificateTemplate.logoUrl')}
                className="pco-input font-mono text-xs"
                placeholder="https://..."
                maxLength={500}
              />
            </Field>
            <Field label="Nome da organização">
              <input
                {...register('certificateTemplate.orgName')}
                className="pco-input"
                placeholder="Psicanálise Clínica Online"
                maxLength={120}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Assinatura — nome">
              <input
                {...register('certificateTemplate.signatureName')}
                className="pco-input"
                placeholder="Direção Acadêmica"
                maxLength={120}
              />
            </Field>
            <Field label="Assinatura — cargo">
              <input
                {...register('certificateTemplate.signatureRole')}
                className="pco-input"
                placeholder="PCO"
                maxLength={120}
              />
            </Field>
          </div>
          <p className="text-[11px] text-ink-subtle">
            Campos vazios usam os defaults globais. Cores devem estar em
            formato #RRGGBB. Use <code>{`{{course}}`}</code> e{' '}
            <code>{`{{hours}}`}</code> no corpo pra inserir título do curso e
            carga horária dinamicamente.
          </p>
        </fieldset>

        <fieldset className="border border-pco-border rounded-lg p-4 space-y-3">
          <legend className="px-2 text-xs font-semibold text-pco-deep">
            Instrutor / Professor
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" error={errors.instructorName?.message}>
              <input
                {...register('instructorName')}
                className="pco-input"
                placeholder="Ex: Dra. Maria Silva"
                maxLength={120}
              />
            </Field>
            <Field
              label="Foto (URL pública)"
              error={errors.instructorPhotoUrl?.message}
            >
              <input
                {...register('instructorPhotoUrl')}
                className="pco-input font-mono text-xs"
                placeholder="https://..."
                maxLength={500}
              />
            </Field>
          </div>
          <Field label="Bio" error={errors.instructorBio?.message}>
            <textarea
              {...register('instructorBio')}
              rows={3}
              className="pco-input resize-none"
              placeholder="Formação acadêmica, anos de experiência, áreas de atuação…"
              maxLength={2000}
            />
          </Field>
        </fieldset>

        <fieldset className="border border-pco-border rounded-lg p-4 space-y-3">
          <legend className="px-2 text-xs font-semibold text-pco-deep">
            Co-instrutores ({collaborators.length}/10)
          </legend>
          {collaborators.length === 0 ? (
            <p className="text-xs text-ink-subtle">
              Nenhum co-instrutor adicionado.
            </p>
          ) : (
            <ul className="space-y-3">
              {collaborators.map((c, idx) => (
                <li key={idx} className="bg-surface-off rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] font-bold text-pco-deep">
                      Co-instrutor {idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCollaborator(idx)}
                      className="text-status-danger text-xs hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={c.name}
                      onChange={(e) => updateCollaborator(idx, 'name', e.target.value)}
                      className="pco-input text-sm"
                      placeholder="Nome*"
                      maxLength={120}
                    />
                    <input
                      value={c.role ?? ''}
                      onChange={(e) => updateCollaborator(idx, 'role', e.target.value)}
                      className="pco-input text-sm"
                      placeholder="Papel (ex: Professor convidado)"
                      maxLength={120}
                    />
                  </div>
                  <input
                    value={c.photoUrl ?? ''}
                    onChange={(e) => updateCollaborator(idx, 'photoUrl', e.target.value)}
                    className="pco-input text-sm font-mono text-xs"
                    placeholder="Foto URL (opcional)"
                    maxLength={500}
                  />
                  <textarea
                    value={c.bio ?? ''}
                    onChange={(e) => updateCollaborator(idx, 'bio', e.target.value)}
                    rows={2}
                    className="pco-input text-sm resize-none"
                    placeholder="Bio curta (opcional)"
                    maxLength={1000}
                  />
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={addCollaborator}
            disabled={collaborators.length >= 10}
            className="pco-btn-ghost text-xs"
          >
            + Adicionar co-instrutor
          </button>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Carga horária (h)" error={errors.totalHours?.message}>
            <input
              type="number"
              {...register('totalHours', { valueAsNumber: true })}
              className="pco-input"
            />
          </Field>
          <Field label="Certificado">
            <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('certificateAvailable')}
                className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
              />
              <span className="text-sm text-pco-deep">Habilitado</span>
            </label>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-gray">
          <button
            type="button"
            onClick={() =>
              reset({
                title: course.title,
                slug: course.slug,
                shortTitle: course.shortTitle,
                description: course.description,
                totalHours: course.totalHours,
                certificateAvailable: course.certificateAvailable,
                coverColor: course.coverColor,
              })
            }
            disabled={!isDirty || update.isPending}
            className="pco-btn-ghost text-xs"
          >
            Reverter
          </button>
          <button
            type="submit"
            disabled={!isDirty || update.isPending}
            className="pco-btn-primary text-xs"
          >
            {update.isPending ? (
              <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            ) : (
              <Save size={12} strokeWidth={2} />
            )}
            Salvar alterações
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="pco-card">
          <Field label="Capa do curso">
            <div className={`h-32 rounded-xl bg-gradient-to-br ${course.coverColor} mb-3`} />
            <button type="button" className="pco-btn-secondary w-full justify-center text-xs">
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
    </form>
  );
}

function ModulosPane({ course }: { course: Course }) {
  const toast = useToast();
  const createModuleMut = useCreateModule();
  const updateModuleMut = useUpdateModule(course.id);
  const deleteModuleMut = useDeleteModule(course.id);
  const createLessonMut = useCreateLesson(course.id);
  const updateLessonMut = useUpdateLesson(course.id);
  const deleteLessonMut = useDeleteLesson(course.id);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(course.modules.map((m, i) => [m.id, i === 0])),
  );
  const [editingModule, setEditingModule] = useState<Module | 'new' | null>(null);
  const [confirmDeleteModule, setConfirmDeleteModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<{
    moduleId: string;
    lesson: Lesson | null;
  } | null>(null);
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<Lesson | null>(null);

  const moduleSubmitting = createModuleMut.isPending || updateModuleMut.isPending;
  const lessonSubmitting = createLessonMut.isPending || updateLessonMut.isPending;

  const handleModuleSubmit = async (data: CreateModuleInput) => {
    try {
      if (editingModule === 'new') {
        await createModuleMut.mutateAsync({ courseId: course.id, input: data });
        toast.success('Módulo criado', data.title);
      } else if (editingModule) {
        await updateModuleMut.mutateAsync({ id: editingModule.id, patch: data });
        toast.success('Módulo atualizado', data.title);
      }
      setEditingModule(null);
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleLessonSubmit = async (data: CreateLessonInput) => {
    if (!editingLesson) return;
    try {
      if (editingLesson.lesson === null) {
        await createLessonMut.mutateAsync({
          moduleId: editingLesson.moduleId,
          input: data,
        });
        toast.success('Aula criada', data.title);
      } else {
        await updateLessonMut.mutateAsync({
          id: editingLesson.lesson.id,
          patch: data,
        });
        toast.success('Aula atualizada', data.title);
      }
      setEditingLesson(null);
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleDeleteModule = async () => {
    if (!confirmDeleteModule) return;
    try {
      await deleteModuleMut.mutateAsync(confirmDeleteModule.id);
      toast.success('Módulo excluído', confirmDeleteModule.title);
      setConfirmDeleteModule(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleDeleteLesson = async () => {
    if (!confirmDeleteLesson) return;
    try {
      await deleteLessonMut.mutateAsync(confirmDeleteLesson.id);
      toast.success('Aula excluída', confirmDeleteLesson.title);
      setConfirmDeleteLesson(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pco-deep">
          Módulos · {course.modules.length}
        </h3>
        <button
          onClick={() => setEditingModule('new')}
          className="pco-btn-primary text-xs"
        >
          <Plus size={12} strokeWidth={2} />
          Novo módulo
        </button>
      </div>

      <ul className="space-y-2">
        {course.modules.map((module, i) => {
          const isOpen = !!expanded[module.id];
          return (
            <li key={module.id} className="pco-card p-0 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [module.id]: !isOpen }))}
                  className="text-ink-muted hover:text-pco-deep h-7 w-7 grid place-items-center rounded-lg hover:bg-surface-gray"
                  aria-label={isOpen ? 'Fechar' : 'Expandir'}
                >
                  {isOpen ? (
                    <ChevronDown size={16} strokeWidth={1.75} />
                  ) : (
                    <ChevronRight size={16} strokeWidth={1.75} />
                  )}
                </button>
                <div className="h-8 w-8 rounded-lg bg-pco-blue/10 grid place-items-center text-xs font-bold text-pco-blue shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-pco-deep">{module.title}</div>
                  <div className="text-[11px] text-ink-subtle">
                    {module.lessons.length} aula(s) ·{' '}
                    {module.assessment ? '1 avaliação' : 'sem avaliação'}
                  </div>
                </div>
                <button
                  onClick={() => setEditingModule(module)}
                  className="pco-btn-ghost text-xs px-2.5"
                  title="Editar módulo"
                >
                  <Edit3 size={12} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setConfirmDeleteModule(module)}
                  className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
                  title="Excluir módulo"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-surface-gray bg-surface-off px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-subtle">
                      Aulas do módulo
                    </div>
                    <button
                      onClick={() => setEditingLesson({ moduleId: module.id, lesson: null })}
                      className="pco-btn-secondary text-xs"
                    >
                      <Plus size={12} strokeWidth={2} />
                      Nova aula
                    </button>
                  </div>
                  {module.lessons.length === 0 ? (
                    <p className="text-xs text-ink-muted py-3 text-center">
                      Nenhuma aula ainda. Clique em Nova aula para criar.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {module.lessons.map((lesson) => (
                        <li
                          key={lesson.id}
                          className="flex items-center gap-3 bg-white rounded-lg border border-surface-gray p-3"
                        >
                          <Video
                            size={14}
                            className="text-pco-blue shrink-0"
                            strokeWidth={1.75}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-pco-deep truncate">
                              {lesson.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-subtle">
                              <span className="inline-flex items-center gap-1">
                                <Clock size={10} />
                                {lesson.durationMinutes} min
                              </span>
                              {lesson.isMandatory ? (
                                <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                                  Obrigatória
                                </span>
                              ) : (
                                <span className="pco-badge bg-surface-gray text-ink-muted">
                                  Opcional
                                </span>
                              )}
                              <span>· ordem {lesson.order}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingLesson({ moduleId: module.id, lesson })}
                            className="pco-btn-ghost text-xs px-2"
                            title="Editar"
                          >
                            <Edit3 size={11} strokeWidth={1.75} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteLesson(lesson)}
                            className="pco-btn-ghost text-xs px-2 text-status-danger hover:bg-status-danger/10"
                            title="Excluir"
                          >
                            <Trash2 size={11} strokeWidth={1.75} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {course.modules.length === 0 && (
          <li className="pco-card text-center py-8">
            <p className="text-sm text-ink-muted">
              Nenhum módulo. Clique em Novo módulo para começar.
            </p>
          </li>
        )}
      </ul>

      {editingModule && (
        <ModuleEditor
          module={editingModule === 'new' ? null : editingModule}
          nextOrder={course.modules.length + 1}
          submitting={moduleSubmitting}
          onClose={() => setEditingModule(null)}
          onSubmit={handleModuleSubmit}
        />
      )}

      {editingLesson && (
        <LessonEditor
          lesson={editingLesson.lesson}
          moduleTitle={
            course.modules.find((m) => m.id === editingLesson.moduleId)?.title ?? 'Módulo'
          }
          nextOrder={
            (course.modules.find((m) => m.id === editingLesson.moduleId)?.lessons.length ?? 0) + 1
          }
          submitting={lessonSubmitting}
          onClose={() => setEditingLesson(null)}
          onSubmit={handleLessonSubmit}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteModule}
        title="Excluir módulo?"
        description={
          confirmDeleteModule && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDeleteModule.title}</span> e{' '}
              <strong>todas as suas {confirmDeleteModule.lessons.length} aulas</strong> serão
              removidos permanentemente.
            </>
          )
        }
        confirmLabel="Excluir módulo"
        variant="danger"
        loading={deleteModuleMut.isPending}
        onCancel={() => setConfirmDeleteModule(null)}
        onConfirm={handleDeleteModule}
      />

      <ConfirmDialog
        open={!!confirmDeleteLesson}
        title="Excluir aula?"
        description={
          confirmDeleteLesson && (
            <>
              A aula <span className="font-semibold text-pco-deep">{confirmDeleteLesson.title}</span>{' '}
              será removida.
            </>
          )
        }
        confirmLabel="Excluir aula"
        variant="danger"
        loading={deleteLessonMut.isPending}
        onCancel={() => setConfirmDeleteLesson(null)}
        onConfirm={handleDeleteLesson}
      />
    </div>
  );
}

interface ModuleEditorProps {
  module: Module | null;
  nextOrder: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateModuleInput) => Promise<void>;
}

function ModuleEditor({ module, nextOrder, submitting, onClose, onSubmit }: ModuleEditorProps) {
  const isNew = module === null;
  type FormInput = z.input<typeof createModuleSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, CreateModuleInput>({
    resolver: zodResolver(createModuleSchema),
    defaultValues: {
      title: module?.title ?? '',
      description: module?.description ?? '',
      order: module?.order ?? nextOrder,
      releaseAt: module?.releaseAt
        ? new Date(module.releaseAt).toISOString().slice(0, 16)
        : '',
      releaseAfterEnrollmentDays:
        module?.releaseAfterEnrollmentDays ?? undefined,
    },
  });

  return (
    <ModalShell
      title={isNew ? 'Novo módulo' : 'Editar módulo'}
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
        <Field label="Título" error={errors.title?.message}>
          <input {...register('title')} className="pco-input" />
        </Field>
        <Field label="Descrição" error={errors.description?.message}>
          <textarea
            {...register('description')}
            rows={3}
            className="pco-input resize-none"
          />
        </Field>
        <Field label="Ordem" error={errors.order?.message}>
          <input
            type="number"
            min={1}
            {...register('order', { valueAsNumber: true })}
            className="pco-input w-32"
          />
        </Field>
        <Field
          label="Liberação em data fixa (opcional)"
          error={errors.releaseAt?.message}
        >
          <input
            type="datetime-local"
            {...register('releaseAt')}
            className="pco-input"
          />
          <p className="text-[11px] text-ink-subtle mt-1">
            Se preenchido, módulo só libera a partir desta data/hora pra
            todos os alunos (drip absoluto).
          </p>
        </Field>

        <Field
          label="Liberar N dias após matrícula (opcional)"
          error={errors.releaseAfterEnrollmentDays?.message}
        >
          <input
            type="number"
            min={1}
            max={365}
            {...register('releaseAfterEnrollmentDays', {
              setValueAs: (v) =>
                v === '' || v === null || v === undefined
                  ? undefined
                  : Number(v),
            })}
            className="pco-input w-32"
            placeholder="Ex: 7"
          />
          <p className="text-[11px] text-ink-subtle mt-1">
            Drip relativo: cada aluno só vê este módulo N dias após sua
            matrícula no curso. Útil pra cohorts pedagógicas. Se ambos
            (data fixa + dias) forem preenchidos, o módulo só libera
            quando AMBOS já tiverem passado.
          </p>
        </Field>
        <ModalFooter onClose={onClose} submitting={submitting} isNew={isNew} entityLabel="módulo" />
      </form>
    </ModalShell>
  );
}

interface LessonEditorProps {
  lesson: Lesson | null;
  moduleTitle: string;
  nextOrder: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLessonInput) => Promise<void>;
}

function LessonEditor({
  lesson,
  moduleTitle,
  nextOrder,
  submitting,
  onClose,
  onSubmit,
}: LessonEditorProps) {
  const isNew = lesson === null;
  type FormInput = z.input<typeof createLessonSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, CreateLessonInput>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      title: lesson?.title ?? '',
      durationMinutes: lesson?.durationMinutes ?? 0,
      videoUrl: lesson?.videoUrl ?? '',
      description: lesson?.description ?? '',
      isMandatory: lesson?.isMandatory ?? true,
      order: lesson?.order ?? nextOrder,
      isPreview: lesson?.isPreview ?? false,
    },
  });

  return (
    <ModalShell
      title={isNew ? 'Nova aula' : 'Editar aula'}
      subtitle={moduleTitle}
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
        <Field label="Título" error={errors.title?.message}>
          <input {...register('title')} className="pco-input" />
        </Field>
        <Field label="URL do vídeo (opcional)" error={errors.videoUrl?.message}>
          <input
            {...register('videoUrl')}
            className="pco-input font-mono text-xs"
            placeholder="https://..."
          />
        </Field>
        <Field label="Descrição (opcional)">
          <textarea
            {...register('description')}
            rows={3}
            className="pco-input resize-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duração (min)" error={errors.durationMinutes?.message}>
            <input
              type="number"
              min={0}
              max={600}
              {...register('durationMinutes', { valueAsNumber: true })}
              className="pco-input"
            />
          </Field>
          <Field label="Ordem" error={errors.order?.message}>
            <input
              type="number"
              min={1}
              {...register('order', { valueAsNumber: true })}
              className="pco-input"
            />
          </Field>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
            <input
              type="checkbox"
              {...register('isMandatory')}
              className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
            />
            <span className="text-sm text-pco-deep font-medium">Aula obrigatória</span>
          </label>
          <label className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
            <input
              type="checkbox"
              {...register('isPreview')}
              className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue mt-0.5"
            />
            <span className="text-sm">
              <span className="text-pco-deep font-medium block">Preview livre</span>
              <span className="text-[11px] text-ink-muted">
                Aula visível pra visitantes não matriculados (teaser de marketing).
              </span>
            </span>
          </label>
        </div>
        <ModalFooter onClose={onClose} submitting={submitting} isNew={isNew} entityLabel="aula" />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  subtitle,
  submitting,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  submitting: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
      onClick={(e) => {
        if (e.currentTarget === e.target && !submitting) onClose();
      }}
    >
      <div className="absolute inset-0 bg-pco-deep/50 backdrop-blur-sm" />
      <div className="relative pco-card w-full max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-surface-gray px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            {subtitle && (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {subtitle}
              </div>
            )}
            <h2 className="text-lg font-bold text-pco-deep">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-gray"
            aria-label="Fechar"
            disabled={submitting}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  submitting,
  isNew,
  entityLabel,
}: {
  onClose: () => void;
  submitting: boolean;
  isNew: boolean;
  entityLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-gray">
      <button
        type="button"
        onClick={onClose}
        className="pco-btn-ghost text-xs"
        disabled={submitting}
      >
        Cancelar
      </button>
      <button type="submit" className="pco-btn-primary text-xs" disabled={submitting}>
        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {isNew ? `Criar ${entityLabel}` : 'Salvar alterações'}
      </button>
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

function AvaliacoesPane({ course }: { course: Course }) {
  const toast = useToast();
  const upsertMut = useUpsertAssessment(course.id);
  const deleteMut = useDeleteAssessment(course.id);

  const [editing, setEditing] = useState<{
    moduleId: string;
    moduleTitle: string;
    current: Assessment | null;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    assessmentId: string;
    title: string;
  } | null>(null);

  const assessments = course.modules.filter((m) => m.assessment);

  const handleSubmit = async (data: CreateAssessmentInput) => {
    if (!editing) return;
    try {
      await upsertMut.mutateAsync({ moduleId: editing.moduleId, input: data });
      toast.success(
        editing.current ? 'Avaliação atualizada' : 'Avaliação criada',
        data.title,
      );
      setEditing(null);
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.assessmentId);
      toast.success('Avaliação excluída', confirmDelete.title);
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Falha ao excluir', err instanceof Error ? err.message : 'Erro');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-pco-deep">
          Avaliações · {assessments.length} de {course.modules.length} módulos
        </h3>
      </div>

      {course.modules.length === 0 && (
        <div className="pco-card text-center py-6">
          <p className="text-sm text-ink-muted">
            Crie módulos primeiro (aba Módulos) para adicionar avaliações.
          </p>
        </div>
      )}

      {course.modules.map((m, i) => (
        <div key={m.id} className="pco-card flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-pco-blue/10 grid place-items-center text-xs font-bold text-pco-blue shrink-0">
            {i + 1}
          </div>
          <ScrollText
            size={16}
            className={m.assessment ? 'text-pco-orange' : 'text-ink-subtle'}
            strokeWidth={1.75}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              {m.title}
            </div>
            {m.assessment ? (
              <>
                <div className="text-sm font-semibold text-pco-deep">{m.assessment.title}</div>
                <div className="text-[11px] text-ink-subtle">
                  {m.assessment.questionCount} questões · aprovação {m.assessment.passingScore}%
                  {m.assessment.timeLimitMinutes
                    ? ` · ${m.assessment.timeLimitMinutes} min`
                    : ''}
                </div>
              </>
            ) : (
              <div className="text-sm text-ink-muted italic">Sem avaliação configurada</div>
            )}
          </div>
          {m.assessment ? (
            <>
              <button
                onClick={() =>
                  setEditing({
                    moduleId: m.id,
                    moduleTitle: m.title,
                    current: m.assessment ?? null,
                  })
                }
                className="pco-btn-ghost text-xs"
              >
                <Edit3 size={12} strokeWidth={1.75} />
                Editar
              </button>
              <button
                onClick={() =>
                  setConfirmDelete({
                    assessmentId: m.assessment!.id,
                    title: m.assessment!.title,
                  })
                }
                className="pco-btn-ghost text-xs px-2.5 text-status-danger hover:bg-status-danger/10"
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing({ moduleId: m.id, moduleTitle: m.title, current: null })}
              className="pco-btn-secondary text-xs"
            >
              <Plus size={12} strokeWidth={2} />
              Criar avaliação
            </button>
          )}
        </div>
      ))}

      {editing && (
        <AssessmentEditor
          assessment={editing.current}
          moduleTitle={editing.moduleTitle}
          submitting={upsertMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir avaliação?"
        description={
          confirmDelete && (
            <>
              <span className="font-semibold text-pco-deep">{confirmDelete.title}</span> será
              removida do módulo.
            </>
          )
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

interface AssessmentEditorProps {
  assessment: Assessment | null;
  moduleTitle: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAssessmentInput) => Promise<void>;
}

function AssessmentEditor({
  assessment,
  moduleTitle,
  submitting,
  onClose,
  onSubmit,
}: AssessmentEditorProps) {
  const isNew = assessment === null;
  type FormInput = z.input<typeof createAssessmentSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, CreateAssessmentInput>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: {
      title: assessment?.title ?? `Avaliação — ${moduleTitle}`,
      questionCount: assessment?.questionCount ?? 10,
      passingScore: assessment?.passingScore ?? 70,
      timeLimitMinutes: assessment?.timeLimitMinutes,
    },
  });

  return (
    <ModalShell
      title={isNew ? 'Nova avaliação' : 'Editar avaliação'}
      subtitle={moduleTitle}
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
        <Field label="Título" error={errors.title?.message}>
          <input {...register('title')} className="pco-input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantidade de questões" error={errors.questionCount?.message}>
            <input
              type="number"
              min={1}
              max={200}
              {...register('questionCount', { valueAsNumber: true })}
              className="pco-input"
            />
          </Field>
          <Field label="Nota de aprovação (%)" error={errors.passingScore?.message}>
            <input
              type="number"
              min={0}
              max={100}
              {...register('passingScore', { valueAsNumber: true })}
              className="pco-input"
            />
          </Field>
        </div>
        <Field label="Tempo limite (min, opcional)" error={errors.timeLimitMinutes?.message}>
          <input
            type="number"
            min={1}
            max={600}
            {...register('timeLimitMinutes', {
              setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
            })}
            className="pco-input w-32"
            placeholder="Sem limite"
          />
        </Field>
        <ModalFooter
          onClose={onClose}
          submitting={submitting}
          isNew={isNew}
          entityLabel="avaliação"
        />
      </form>
    </ModalShell>
  );
}

function CertificadoPane({ course }: { course: Course }) {
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

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-ink-muted mb-1.5">{label}</div>
      {children}
      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}
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
