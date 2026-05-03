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
  useUpdateCourse,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
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
} from '../../../../shared/schemas';
import type { Course, Module, Lesson } from '../../types/schema';

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
          <Link to={`/curso/${course.id}`} className="pco-btn-secondary text-xs">
            <Eye size={12} strokeWidth={2} />
            Pré-visualizar
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
    },
  });

  const onSubmit = async (data: UpdateCourseInput) => {
    try {
      const updated = await update.mutateAsync({ id: course.id, patch: data });
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
        <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-off cursor-pointer">
          <input
            type="checkbox"
            {...register('isMandatory')}
            className="h-4 w-4 rounded text-pco-blue focus:ring-pco-blue"
          />
          <span className="text-sm text-pco-deep font-medium">Aula obrigatória</span>
        </label>
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
