import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Save, Loader2, Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { updateCourseSchema, type UpdateCourseInput } from '../../../../shared/schemas';
import { useUpdateCourse } from '../../data/hooks';
import { useToast } from '../../components/Toast';
import type { Course } from '../../types/schema';

/**
 * Aba "Página pública" do editor de curso.
 *
 * Edita os campos que só aparecem no site público SSR (/formacao/:slug) e que
 * antes só existiam se alguém editasse o JSON na mão. Dois deles alimentam
 * estrutura de dados para busca e IA: `tldr` vira a meta description e o
 * parágrafo answer-first, `faqs` vira o bloco FAQPage do JSON-LD.
 *
 * Form próprio, separado do da aba Geral: o PUT aceita patch parcial, então
 * salvar aqui não toca em nada das outras abas.
 */

interface Faq {
  q: string;
  a: string;
}
interface CurriculumItem {
  n?: string;
  title: string;
  desc?: string;
}

type ScalarFields = Pick<
  UpdateCourseInput,
  'publicListed' | 'badge' | 'tagline' | 'tldr' | 'level' | 'language' | 'monthsMin' | 'monthsMax'
>;

export default function CoursePublicPane({ course }: { course: Course }) {
  const update = useUpdateCourse();
  const toast = useToast();

  const [forWhom, setForWhom] = useState<string[]>(course.forWhom ?? []);
  const [faqs, setFaqs] = useState<Faq[]>(course.faqs ?? []);
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>(course.curriculum ?? []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScalarFields>({
    resolver: zodResolver(
      updateCourseSchema.pick({
        publicListed: true,
        badge: true,
        tagline: true,
        tldr: true,
        level: true,
        language: true,
        monthsMin: true,
        monthsMax: true,
      }),
    ),
    defaultValues: {
      // Ausente vale "sim": curso que nunca tocou no campo segue visível.
      publicListed: course.publicListed !== false,
      badge: course.badge ?? '',
      tagline: course.tagline ?? '',
      tldr: course.tldr ?? '',
      level: course.level ?? '',
      language: course.language ?? '',
      monthsMin: course.monthsMin,
      monthsMax: course.monthsMax,
    },
  });

  async function onSubmit(data: ScalarFields) {
    try {
      await update.mutateAsync({
        id: course.id,
        patch: {
          ...data,
          forWhom: forWhom.map((s) => s.trim()).filter((s) => s.length >= 2),
          faqs: faqs
            .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
            .filter((f) => f.q.length >= 2 && f.a.length >= 2),
          curriculum: curriculum
            .map((m) => ({
              ...(m.n?.trim() ? { n: m.n.trim() } : {}),
              title: m.title.trim(),
              ...(m.desc?.trim() ? { desc: m.desc.trim() } : {}),
            }))
            .filter((m) => m.title.length > 0),
        },
      });
      toast.success('Página pública atualizada', course.title);
    } catch (err) {
      toast.error('Falha ao salvar', err instanceof Error ? err.message : 'Erro');
    }
  }

  // Zod v4 é estrito e o submit silencioso já mordeu este projeto: sem onInvalid,
  // o form não faz nada e não diz por quê.
  function onInvalid() {
    toast.warning('Revise os campos', 'Há campos com valor inválido nesta aba.');
  }

  const publicUrl = `/formacao/${course.slug}`;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-5 max-w-3xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-pco-deep flex items-center gap-2">
            <Globe size={16} className="text-pco-blue" strokeWidth={1.75} />
            Página pública
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            O que o visitante vê antes de comprar. O resumo e as perguntas frequentes também são
            lidos por buscadores e assistentes de IA.
          </p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pco-btn-ghost text-xs shrink-0"
        >
          <ExternalLink size={12} strokeWidth={2} />
          Ver página
        </a>
      </header>

      {hasErrors && (
        <div className="pco-card p-3 border-status-danger/30 bg-status-danger/5 flex items-start gap-2">
          <AlertCircle size={14} className="text-status-danger mt-0.5" strokeWidth={2} />
          <div className="text-xs text-ink-muted">
            {Object.entries(errors).map(([k, e]) => (
              <div key={k}>
                <span className="font-semibold text-pco-deep">{k}</span>: {e?.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="pco-card p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register('publicListed')}
            className="mt-0.5 h-4 w-4 shrink-0 accent-pco-blue"
          />
          <span>
            <span className="text-sm font-semibold text-pco-deep block">
              Divulgar este curso no site público
            </span>
            <span className="text-xs text-ink-muted block mt-0.5">
              Controla apenas a vitrine: catálogo, página de venda, sitemap e llms.txt. Desmarcar{' '}
              <strong>não</strong> tira o acesso de quem já está matriculado — para isso existe
              “Despublicar curso”, na aba Geral.
            </span>
          </span>
        </label>
      </section>

      <section className="pco-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-pco-deep">Topo da página</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Selo</span>
            <input
              {...register('badge')}
              placeholder="Curso principal"
              className="pco-input mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Nível exibido
            </span>
            <input
              {...register('level')}
              placeholder="Formação profissional"
              className="pco-input mt-1 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            Frase de efeito
          </span>
          <input
            {...register('tagline')}
            placeholder="Uma formação para quem quer atender de verdade"
            className="pco-input mt-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Resumo curto</span>
          <textarea
            {...register('tldr')}
            rows={3}
            maxLength={600}
            placeholder="Em duas ou três frases: o que é, para quem serve e o que a pessoa consegue fazer ao final."
            className="pco-input mt-1 text-sm resize-none"
          />
          <span className="text-[11px] text-ink-subtle">
            Vira a descrição da página nos resultados de busca e o primeiro trecho que assistentes
            de IA leem. Responda logo na primeira frase.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Idioma</span>
            <input
              {...register('language')}
              placeholder="pt-BR"
              className="pco-input mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Acesso mín. (meses)
            </span>
            <input
              type="number"
              min={0}
              max={120}
              {...register('monthsMin', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
              className="pco-input mt-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">
              Acesso máx. (meses)
            </span>
            <input
              type="number"
              min={0}
              max={120}
              {...register('monthsMax', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
              className="pco-input mt-1 text-sm"
            />
          </label>
        </div>
      </section>

      <ListSection
        title="Para quem é"
        hint="Um item por linha. Aparece como lista na página."
        items={forWhom}
        onAdd={() => setForWhom((p) => [...p, ''])}
        onRemove={(i) => setForWhom((p) => p.filter((_, x) => x !== i))}
        render={(item, i) => (
          <input
            value={item}
            onChange={(e) => setForWhom((p) => p.map((v, x) => (x === i ? e.target.value : v)))}
            placeholder="Psicólogos que querem atender pela escuta"
            className="pco-input text-sm"
          />
        )}
      />

      <ListSection
        title="Perguntas frequentes"
        hint="Cada par pergunta/resposta vira um item estruturado que o Google pode exibir direto no resultado."
        items={faqs}
        onAdd={() => setFaqs((p) => [...p, { q: '', a: '' }])}
        onRemove={(i) => setFaqs((p) => p.filter((_, x) => x !== i))}
        render={(item, i) => (
          <div className="space-y-2">
            <input
              value={item.q}
              onChange={(e) =>
                setFaqs((p) => p.map((v, x) => (x === i ? { ...v, q: e.target.value } : v)))
              }
              placeholder="Preciso ter graduação em psicologia?"
              className="pco-input text-sm"
            />
            <textarea
              value={item.a}
              onChange={(e) =>
                setFaqs((p) => p.map((v, x) => (x === i ? { ...v, a: e.target.value } : v)))
              }
              rows={2}
              placeholder="Não. A formação é livre e aceita pessoas de qualquer graduação."
              className="pco-input text-sm resize-none"
            />
          </div>
        )}
      />

      <ListSection
        title="Ementa resumida"
        hint="Visão geral por módulo — não substitui os módulos reais do curso."
        items={curriculum}
        onAdd={() =>
          setCurriculum((p) => [
            ...p,
            { n: String(p.length + 1).padStart(2, '0'), title: '', desc: '' },
          ])
        }
        onRemove={(i) => setCurriculum((p) => p.filter((_, x) => x !== i))}
        render={(item, i) => (
          <div className="grid gap-2 sm:grid-cols-[70px_1fr]">
            <input
              value={item.n ?? ''}
              onChange={(e) =>
                setCurriculum((p) => p.map((v, x) => (x === i ? { ...v, n: e.target.value } : v)))
              }
              placeholder="01"
              className="pco-input text-sm font-mono"
            />
            <div className="space-y-2">
              <input
                value={item.title}
                onChange={(e) =>
                  setCurriculum((p) =>
                    p.map((v, x) => (x === i ? { ...v, title: e.target.value } : v)),
                  )
                }
                placeholder="Fundamentos da escuta clínica"
                className="pco-input text-sm"
              />
              <input
                value={item.desc ?? ''}
                onChange={(e) =>
                  setCurriculum((p) =>
                    p.map((v, x) => (x === i ? { ...v, desc: e.target.value } : v)),
                  )
                }
                placeholder="O que o aluno vê neste módulo"
                className="pco-input text-sm"
              />
            </div>
          </div>
        )}
      />

      <div className="flex items-center justify-end gap-2 pb-2">
        <button type="submit" disabled={update.isPending} className="pco-btn-primary">
          {update.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} strokeWidth={2} />
          )}
          Salvar página pública
        </button>
      </div>
    </form>
  );
}

interface ListSectionProps<T> {
  title: string;
  hint: string;
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  render: (item: T, index: number) => React.ReactNode;
}

function ListSection<T>({ title, hint, items, onAdd, onRemove, render }: ListSectionProps<T>) {
  return (
    <section className="pco-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-pco-deep">{title}</h3>
          <p className="text-[11px] text-ink-muted mt-0.5 max-w-lg">{hint}</p>
        </div>
        <button type="button" onClick={onAdd} className="pco-btn-secondary text-xs shrink-0">
          <Plus size={11} strokeWidth={2} />
          Adicionar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-ink-subtle">Nada aqui ainda — a seção não aparece na página.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">{render(item, i)}</div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="pco-btn-ghost text-xs text-status-danger shrink-0"
                aria-label={`Remover item ${i + 1}`}
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
