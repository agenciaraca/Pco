import { BookOpen, Download, Filter, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLibrary, useCourses } from '../data/hooks';
import { CardListSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useT } from '../i18n';
import { SemConexao, FalhaAoCarregar } from '../components/EstadosDeConsulta';
import { combina } from '../lib/busca';

type CourseFilter = 'all' | string;
type MandatoryFilter = 'all' | 'mandatory' | 'optional';
type TypeFilter = 'all' | 'pdf' | 'apostila' | 'leitura' | 'artigo';

/*
  Lista vazia estável.

  `data ?? []` cria um array novo a cada render, e todo `useMemo` que dependa
  dele recalcula sempre — o que é justamente o oposto do que o `useMemo` está
  ali para fazer.
*/
const VAZIO: never[] = [];

export default function Library() {
  const t = useT();
  const libraryQ = useLibrary();
  const libraryItems = libraryQ.data ?? VAZIO;
  const { data: courses = [] } = useCourses();
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
  const [mandatoryFilter, setMandatoryFilter] = useState<MandatoryFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of libraryItems) {
      for (const t of it.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [libraryItems]);

  /*
    Os filtros saem do acervo, e so aparecem quando podem dividi-lo.

    Em 10/set/2026 entraram 108 PDFs do LMS antigo, e os quatro filtros desta
    tela viraram constantes: todos `pdf`, todos nao-obrigatorios, nenhum ligado
    a curso, todos com a mesma tag. Cada um dividia 108 em 108-e-0.

    Um filtro que nao divide nada nao e so ruido -- ele MENTE. A lista de tipos
    era cravada (`pdf | apostila | leitura | artigo`), entao quem clicasse em
    "APOSTILA" recebia "nenhum material com esses filtros", que se le como *a
    escola nao tem apostilas*. E a mesma regra que este projeto aplica as telas
    de metrica: ausencia de resultado nao pode passar por ausencia de acervo.

    Por isso as opcoes saem dos itens que existem -- como `allTags` ja fazia --
    e o bloco inteiro some quando sobra uma opcao so.
  */
  const tiposPresentes = useMemo(() => {
    const set = new Set<string>();
    for (const it of libraryItems) if (it.type) set.add(it.type);
    return Array.from(set).sort();
  }, [libraryItems]);

  const cursosComMaterial = useMemo(
    () => courses.filter((c) => libraryItems.some((it) => it.relatedCourseIds?.includes(c.id))),
    [courses, libraryItems],
  );

  const temObrigatorioEComplementar = useMemo(
    () => libraryItems.some((it) => it.mandatory) && libraryItems.some((it) => !it.mandatory),
    [libraryItems],
  );

  const filtered = useMemo(() => {
    return libraryItems.filter((item) => {
      if (courseFilter !== 'all') {
        if (!item.relatedCourseIds?.includes(courseFilter)) return false;
      }
      if (mandatoryFilter === 'mandatory' && !item.mandatory) return false;
      if (mandatoryFilter === 'optional' && item.mandatory) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (activeTag && !(item.tags ?? []).includes(activeTag)) return false;
      // Titulo E autor: o autor e a segunda coisa que alguem sabe de um
      // livro, e boa parte deste acervo se acha procurando por "Freud".
      if (!combina(busca, item.title, item.author)) return false;
      return true;
    });
  }, [libraryItems, courseFilter, mandatoryFilter, typeFilter, activeTag, busca]);

  // Sem rede a consulta fica `paused`, e aí `isLoading` e `isError` são
  // os dois `false`: a tela caía no estado vazio e dizia que não há nada,
  // que é a única leitura que faz alguém parar de procurar.
  if (libraryQ.fetchStatus === 'paused') return <SemConexao oQue="a biblioteca" />;
  if (libraryQ.isPending) return <CardListSkeleton count={4} />;
  if (libraryQ.isError)
    return (
      <FalhaAoCarregar
        erro={libraryQ.error}
        oQue="a biblioteca"
        aoTentarDeNovo={() => void libraryQ.refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="pco-section-title">{t('library.title')}</h1>
        <p className="pco-section-subtitle mt-1">
          Materiais, apostilas e leituras curadas pelos seus cursos.
        </p>
      </header>

      <div className="pco-card p-4 space-y-3">
        <label className="relative block">
          <span className="sr-only">Buscar por título ou autor</span>
          <Search
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título ou autor…"
            /*
              `pco-input` e a classe da casa, e ela tem variante de tema escuro
              em theme.css. Escrever as utilitarias a mao com `bg-white`
              cravado daria um campo branco em pagina escura -- o CSS nao
              reclama, e so quem usa o tema escuro ve.
            */
            className="pco-input pl-9 pr-9"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:text-pco-deep"
              title="Limpar busca"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </label>
        {cursosComMaterial.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-surface-mute pt-3">
            <FilterChip
              active={courseFilter === 'all'}
              onClick={() => setCourseFilter('all')}
              label="Todos"
            />
            {cursosComMaterial.map((c) => (
              <FilterChip
                key={c.id}
                active={courseFilter === c.id}
                onClick={() => setCourseFilter(c.id)}
                label={c.shortTitle}
              />
            ))}
          </div>
        )}
        {(temObrigatorioEComplementar || tiposPresentes.length > 1) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-surface-mute pt-3">
            {temObrigatorioEComplementar && (
              <>
                <FilterChip
                  active={mandatoryFilter === 'all'}
                  onClick={() => setMandatoryFilter('all')}
                  label="Tudo"
                />
                <FilterChip
                  active={mandatoryFilter === 'mandatory'}
                  onClick={() => setMandatoryFilter('mandatory')}
                  label="Obrigatórios"
                />
                <FilterChip
                  active={mandatoryFilter === 'optional'}
                  onClick={() => setMandatoryFilter('optional')}
                  label="Complementares"
                />
              </>
            )}
            {temObrigatorioEComplementar && tiposPresentes.length > 1 && (
              <span className="mx-2 h-4 w-px bg-surface-gray" />
            )}
            {tiposPresentes.length > 1 && (
              <>
                <FilterChip
                  active={typeFilter === 'all'}
                  onClick={() => setTypeFilter('all')}
                  label="Qualquer tipo"
                />
                {tiposPresentes.map((tp) => (
                  <FilterChip
                    key={tp}
                    active={typeFilter === tp}
                    onClick={() => setTypeFilter(tp as TypeFilter)}
                    label={tp.toUpperCase()}
                  />
                ))}
              </>
            )}
          </div>
        )}
        {allTags.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs text-ink-subtle uppercase mr-1">Tags:</span>
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`pco-badge text-xs ${
                activeTag === null
                  ? 'bg-pco-blue/10 text-pco-blue'
                  : 'bg-surface-gray text-ink-muted'
              }`}
            >
              Todas
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`pco-badge text-xs ${
                  activeTag === t
                    ? 'bg-pco-blue/10 text-pco-blue'
                    : 'bg-surface-gray text-ink-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          <Filter size={11} strokeWidth={2} />
          {filtered.length} item{filtered.length === 1 ? '' : 's'} de {libraryItems.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={busca ? `Nada encontrado para “${busca}”` : 'Nenhum material com esses filtros'}
          description={
            busca
              ? 'Tente outra palavra do título ou o nome do autor. A busca ignora acentos.'
              : 'Limpe os filtros ou experimente outras combinações.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="pco-card pco-card-hover">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pco-blue/10 to-pco-cyan/10 grid place-items-center shrink-0">
                  <BookOpen size={20} className="text-pco-blue" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="pco-badge bg-pco-blue/10 text-pco-blue uppercase">
                      {item.type}
                    </span>
                    {item.mandatory && (
                      <span className="pco-badge bg-pco-orange/10 text-pco-orange">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-pco-deep">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">por {item.author}</p>
                  {item.theme && (
                    <p className="mt-0.5 text-xs text-ink-subtle">{item.theme}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {/*
                  Sem arquivo, nao ha botao -- ha uma frase.

                  O `href` caia em `'#'`: o cartao mostrava "Abrir", a pessoa
                  clicava e nada acontecia. Botao que promete o que nao pode
                  cumprir e a mesma classe do filtro que nao divide nada, e o
                  silencio e pior: quem clica conclui que o site esta quebrado,
                  quando o que falta e alguem anexar o PDF.
                */}
                {item.fileMockUrl ? (
                  <a
                    href={item.fileMockUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pco-btn-primary flex-1 justify-center text-xs"
                  >
                    <Download size={12} strokeWidth={2} />
                    Abrir
                  </a>
                ) : (
                  <p className="flex-1 text-center text-xs text-ink-subtle">
                    Arquivo ainda não anexado
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'pco-btn-secondary text-xs ring-2 ring-pco-blue'
          : 'pco-btn-ghost text-xs'
      }
    >
      {label}
    </button>
  );
}
