import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LifeBuoy, MessageSquare, Send } from 'lucide-react';
import { useSupportTickets, useCreateSupportTicket } from '../data/hooks';
import { useToast } from '../components/Toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import {
  createSupportTicketSchema,
  type CreateSupportTicketInput,
} from '../../../shared/schemas';
import { useT } from '../i18n';

const categories: { id: CreateSupportTicketInput['category']; label: string }[] = [
  { id: 'duvida_aula', label: 'Dúvida sobre aula' },
  { id: 'acesso', label: 'Acesso' },
  { id: 'certificado', label: 'Certificado' },
  { id: 'tutor', label: 'Tutor Virtual' },
  { id: 'biblioteca', label: 'Biblioteca/Material' },
  { id: 'outro', label: 'Outro' },
];

/**
 * Categorias que podem vir prontas na URL. Quem chega aqui de um aviso — "seu
 * acesso terminou", por exemplo — já sabe do que quer falar; obrigá-lo a
 * escolher de novo num select é fazer o aluno repetir o que a tela já sabia.
 */
const CATEGORIAS_VALIDAS = new Set(categories.map((c) => c.id as string));

export default function Support() {
  const t = useT();
  const ticketsQ = useSupportTickets();
  const createTicket = useCreateSupportTicket();
  const toast = useToast();
  const [params] = useSearchParams();

  const assunto = params.get('assunto');
  const categoriaInicial = (
    assunto && CATEGORIAS_VALIDAS.has(assunto) ? assunto : 'duvida_aula'
  ) as CreateSupportTicketInput['category'];
  const tituloInicial = params.get('titulo') ?? '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSupportTicketInput>({
    resolver: zodResolver(createSupportTicketSchema),
    defaultValues: { category: categoriaInicial, subject: tituloInicial, message: '' },
  });

  const onSubmit = async (data: CreateSupportTicketInput) => {
    try {
      await createTicket.mutateAsync(data);
      toast.success('Solicitação enviada', 'Você receberá uma resposta em breve.');
      reset();
    } catch (err) {
      toast.error(
        'Não foi possível enviar',
        err instanceof Error ? err.message : 'Tente novamente em alguns instantes.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('support.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Estamos aqui para ajudar. Veja a FAQ, abra um chamado ou retome um existente.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          { title: 'Não consigo acessar', desc: 'Login, senha ou autenticação.' },
          { title: 'Problema com aula', desc: 'Vídeo, áudio ou conteúdo.' },
          { title: 'Certificado', desc: 'Emissão, validação ou segunda via.' },
        ].map((c) => (
          <div key={c.title} className="pco-card pco-card-hover">
            <div className="h-10 w-10 rounded-xl bg-pco-blue/10 grid place-items-center mb-3">
              <LifeBuoy size={18} className="text-pco-blue" strokeWidth={1.75} />
            </div>
            <div className="font-semibold text-pco-deep">{c.title}</div>
            <p className="mt-1 text-xs text-ink-muted">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="pco-card space-y-4">
          <h3 className="text-base font-semibold text-pco-deep">Abrir solicitação</h3>

          <div>
            <label htmlFor="category" className="block text-xs font-medium text-ink-muted mb-1.5">
              Categoria
            </label>
            <select id="category" {...register('category')} className="pco-input">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-status-danger">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="subject" className="block text-xs font-medium text-ink-muted mb-1.5">
              Assunto
            </label>
            <input
              id="subject"
              {...register('subject')}
              className={`pco-input ${errors.subject ? 'border-status-danger' : ''}`}
              placeholder="Resumo do seu problema"
              aria-invalid={!!errors.subject}
            />
            {errors.subject && (
              <p className="mt-1 text-xs text-status-danger">{errors.subject.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="message" className="block text-xs font-medium text-ink-muted mb-1.5">
              Descrição
            </label>
            <textarea
              id="message"
              rows={5}
              {...register('message')}
              className={`pco-input resize-none ${errors.message ? 'border-status-danger' : ''}`}
              placeholder="Conte com detalhes o que está acontecendo..."
              aria-invalid={!!errors.message}
            />
            {errors.message && (
              <p className="mt-1 text-xs text-status-danger">{errors.message.message}</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="pco-btn-primary">
            <Send size={14} strokeWidth={2} />
            {isSubmitting ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </form>

        <div className="pco-card">
          <h3 className="text-base font-semibold text-pco-deep mb-4">Histórico</h3>
          {ticketsQ.isLoading ? (
            <TableSkeleton rows={2} />
          ) : (ticketsQ.data ?? []).length === 0 ? (
            <EmptyState
              variant="compact"
              title="Nenhuma solicitação ainda"
              description="Você verá seu histórico de suporte aqui."
            />
          ) : (
            <ul className="space-y-3">
              {(ticketsQ.data ?? []).map((t) => (
                <li key={t.id} className="rounded-xl border border-surface-gray p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-pco-blue" strokeWidth={1.75} />
                      <span className="text-sm font-semibold text-pco-deep">{t.subject}</span>
                    </div>
                    <span
                      className={`pco-badge ${
                        t.status === 'open'
                          ? 'bg-pco-orange/10 text-pco-orange'
                          : t.status === 'in_progress'
                            ? 'bg-pco-blue/10 text-pco-blue'
                            : 'bg-status-success/10 text-status-success'
                      }`}
                    >
                      {t.status === 'open'
                        ? 'Aberto'
                        : t.status === 'in_progress'
                          ? 'Em andamento'
                          : 'Resolvido'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted line-clamp-2">{t.message}</p>
                  <div className="mt-2 text-[11px] text-ink-subtle">
                    Atualizado em {new Date(t.updatedAt).toLocaleDateString('pt-BR')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
