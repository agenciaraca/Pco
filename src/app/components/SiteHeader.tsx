import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

/**
 * O cabeçalho do site — um só, para todas as páginas públicas.
 *
 * Antes, cada página desenhava o seu: fundo branco aqui, cinza ali, com ou sem
 * catálogo, com o botão da direita mudando de nome a cada rota. Quem ia do site
 * para o AVA via o topo trocar debaixo do pé, e a impressão era de sair de um
 * lugar e cair em outro.
 *
 * Duas exceções, de propósito: o **login** (a página não deve oferecer saídas
 * quando o objetivo é entrar) e o **LMS**, onde o topo pertence à aula e não ao
 * site.
 *
 * O fundo é o gradiente da marca, o mesmo do hero, com a logomarca em branco.
 */

/**
 * `externo: true` marca rota servida pelo servidor, não pelo roteador do
 * navegador — `/formacoes` é a vitrine pública renderizada no servidor. Usar
 * <Link> nela daria página em branco, porque o SPA não conhece essa rota.
 */
const LINKS: Array<{ to: string; label: string; externo?: boolean }> = [
  { to: '/catalogo', label: 'Cursos' },
  { to: '/formacoes', label: 'Formações', externo: true },
  { to: '/comparar', label: 'Comparar' },
  { to: '/ava-pco', label: 'Conhecer o AVA' },
];

export default function SiteHeader() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-pco-deep via-pco-blue to-pco-cyan shadow-soft">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0" aria-label="PCO — página inicial">
          <img
            src="/logo-pco-dark.png"
            alt="PCO — Psicanálise Clínica Online"
            className="h-9 w-auto object-contain"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
          {LINKS.map((l) => {
            const atual = pathname === l.to || pathname.startsWith(`${l.to}/`);
            const classe = `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              atual ? 'bg-white/20 text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
            }`;
            return l.externo ? (
              <a key={l.to} href={l.to} className={classe}>
                {l.label}
              </a>
            ) : (
              <Link
                key={l.to}
                to={l.to}
                aria-current={atual ? 'page' : undefined}
                className={classe}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {/* Já logado não deveria ver "Entrar": vê a porta de volta para onde
              estava. É o ponto exato em que a transição site → AVA se perdia. */}
          {user ? (
            <Link
              to="/dashboard"
              className="pco-btn bg-white text-pco-deep hover:bg-white/90 text-sm"
            >
              Meu painel
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="pco-btn text-white hover:bg-white/15 text-sm hidden sm:inline-flex"
              >
                Entrar
              </Link>
              <Link
                to="/catalogo"
                className="pco-btn bg-white text-pco-deep hover:bg-white/90 text-sm"
              >
                Ver cursos
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            className="md:hidden p-2 rounded-lg text-white hover:bg-white/15"
          >
            {aberto ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {aberto && (
        <nav
          className="md:hidden border-t border-white/20 bg-pco-deep/95 backdrop-blur"
          aria-label="Principal (celular)"
        >
          <div className="max-w-6xl mx-auto px-6 py-2 flex flex-col">
            {LINKS.map((l) =>
              l.externo ? (
                <a
                  key={l.to}
                  href={l.to}
                  className="py-2.5 text-sm text-white/90 hover:text-white"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setAberto(false)}
                  className="py-2.5 text-sm text-white/90 hover:text-white"
                >
                  {l.label}
                </Link>
              ),
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
