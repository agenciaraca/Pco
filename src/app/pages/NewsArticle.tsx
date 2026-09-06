import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import { useNews } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import { SemConexao, FalhaAoCarregar, NaoEncontrado } from '../components/EstadosDeConsulta';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

/**
 * A matéria aberta.
 *
 * `/news` listava título e resumo e **não havia como abrir nada** — não existia
 * rota de detalhe nem link nos cards. As 77 matérias têm corpo no banco
 * (`news_articles.body`, todas as 77), e a rota `/news` já devolvia o campo: o
 * texto estava ali, servido pela API, e nenhuma tela o mostrava.
 */
export default function NewsArticle() {
  const { id } = useParams<{ id: string }>();
  const newsQ = useNews();
  const artigo = (newsQ.data ?? []).find((a) => a.id === id);

  useDocumentMeta({ title: artigo ? `${artigo.title} — PCNews` : 'PCNews' });

  if (newsQ.fetchStatus === 'paused') return <SemConexao oQue="esta matéria" />;
  if (newsQ.isPending) return <CardListSkeleton count={2} />;
  if (newsQ.isError)
    return (
      <FalhaAoCarregar
        erro={newsQ.error}
        oQue="esta matéria"
        aoTentarDeNovo={() => void newsQ.refetch()}
      />
    );
  if (!artigo)
    return (
      <NaoEncontrado
        titulo="Não achei esta matéria"
        acao={
          <Link to="/news" className="pco-btn-primary text-sm inline-flex">
            Ver todas as matérias
          </Link>
        }
      >
        Pode ser um link antigo, ou a matéria pode ter saído do ar.
      </NaoEncontrado>
    );

  return (
    <article className="space-y-6">
      <Link
        to="/news"
        className="inline-flex items-center gap-1 text-xs font-medium text-pco-blue hover:underline"
      >
        <ArrowLeft size={13} strokeWidth={2} />
        PCNews
      </Link>

      <header className="space-y-3">
        <span className="pco-badge bg-pco-blue/10 text-pco-blue">{artigo.category}</span>
        <h1 className="text-3xl font-bold tracking-tight text-pco-deep">{artigo.title}</h1>
        <p className="text-base text-ink-muted leading-relaxed">{artigo.excerpt}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <User size={12} strokeWidth={2} />
            {artigo.authorName}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} strokeWidth={2} />
            {new Date(artigo.publishedAt).toLocaleDateString('pt-BR')}
          </span>
          {artigo.tags.map((t) => (
            <span key={t} className="pco-badge bg-surface-gray text-ink-muted">
              {t}
            </span>
          ))}
        </div>
      </header>

      {artigo.body ? (
        <div className="pco-card">
          <div
            className="pco-prose text-sm text-pco-deep leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(limparShortcodes(artigo.body)) }}
          />
        </div>
      ) : (
        /*
          Sem corpo, a matéria é o resumo — e dizer isso é melhor do que uma
          página em branco embaixo do título.
        */
        <p className="pco-card text-sm text-ink-subtle italic">
          Esta matéria ainda não tem o texto completo publicado.
        </p>
      )}
    </article>
  );
}

/**
 * Tira os `[caption]` que vieram do WordPress.
 *
 * O corpo é HTML de lá, e junto vêm shortcodes que o WP resolvia na hora de
 * renderizar. Aqui eles apareceriam como texto no meio da matéria. Só os
 * marcadores saem — a imagem e a legenda que estavam dentro ficam.
 */
function limparShortcodes(html: string): string {
  return html.replace(/\[\/?caption[^\]]*\]/gi, '');
}
