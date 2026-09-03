/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /**
       * ---- Cores: espelho de `docs/design/tokens.css` ----
       *
       * `tokens.css` é a fonte declarada do design. Ele NÃO é importado aqui de
       * propósito: as classes deste projeto usam modificador de opacidade em
       * massa (`bg-status-success/10` aparece 75 vezes, `bg-pco-orange/10` 62),
       * e o Tailwind não sabe aplicar `/10` sobre um `var()` que guarda hex.
       * Trocar para variáveis em canais (`0 151 178`) obrigaria a reescrever
       * também todo o CSS do site público, que consome os tokens como cor.
       *
       * Então a unificação é por VALOR, com `test/tokens-unicos.test.ts`
       * proibindo divergir. É o que evita o problema de verdade: os dois lados
       * andarem para lados diferentes sem ninguém perceber.
       *
       * O que mudou em 31/ago/2026, ao alinhar:
       * - **laranja `#FE9002` → `#ff914d`**. Era a divergência que o handoff
       *   listava em aberto: site público num tom, admin e área do aluno em
       *   outro. O desenho aprovado decide.
       * - neutros e semânticos saíram do padrão do Tailwind (`#16A34A`,
       *   `#D92D20`, `#F59E0B`, `#475467`…) para os do desenho, que são mais
       *   sóbrios e combinam com o site.
       */
      colors: {
        pco: {
          blue: '#0097b2', // --accent — cor de marca, para preenchimento e traço
          /**
           * O mesmo azul, escuro o bastante para **texto** e para fundo de
           * botão com letra branca: 5,09:1 contra o branco, contra 3,46:1 do
           * `blue` de marca. A separação existe porque `bg-pco-blue text-white`
           * era o botão mais usado do produto — "Entrar", "Comprar por R$ …",
           * "Marcar como concluída" — e ficava abaixo do mínimo de texto
           * normal. Marca continua marca; o que carrega letra usa esta.
           */
          'blue-ink': '#00798e',
          cyan: '#0cc0df', // --accent-bright
          'cyan-light': '#5ce1e6', // --accent-light
          orange: '#ff914d', // --brand-orange (2,23:1 — decorativo, nunca texto)
          /** Laranja legível: 4,91:1 no branco. Para CTA e selo com texto. */
          'orange-ink': '#b8530c',
          deep: '#063b49', // --brand-petroleo
          graphite: '#101828', // --ink
          /**
           * Cor de traço. Existia como `border-pco-border` em ~20 arquivos e
           * **não estava declarada**: a classe não gerava CSS e as bordas
           * simplesmente não apareciam.
           */
          border: '#e2e6e3',
        },
        surface: {
          white: '#ffffff', // --raise
          off: '#f9faf8', // --paper (era #f3f4f1 ate 1/set/2026)
          gray: '#eaece6', // --surface-2
          /**
           * Mesma história de `pco-border`: `bg-surface-mute` era usado como
           * fundo de chip de código, cabeçalho de tabela e **trilho de barra de
           * progresso** sem existir no tema — o trilho do quiz era invisível.
           */
          mute: '#eef0ec',
        },
        ink: {
          base: '#101828', // --ink
          muted: '#575c62', // --ink-soft
          /**
           * Era #868c92 (3,40:1) e é aplicado quase sempre em 10–11px. Num
           * público adulto lendo no celular, isso não é detalhe de padrão.
           * Agora 4,65:1 — continua visivelmente mais leve que o `muted`.
           */
          subtle: '#6f757c',
          /** `text-ink-strong` era usado e não existia: o texto caía no padrão. */
          strong: '#101828',
        },
        status: {
          success: '#2f7d4f', // --good
          danger: '#b0422f', // --crit
          warning: '#9a6a12', // --warn
          // Sem token: o dourado é só do selo de certificado.
          gold: '#D6A84F',
        },
      },
      /**
       * Exatamente a pilha de `server/public/styles.ts`. As duas metades do
       * produto precisam ler igual: quem vem do site e entra no AVA não pode
       * ver a letra mudar na fronteira do login.
       */
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        card: '0 4px 16px rgba(6,59,73,0.06), 0 1px 2px rgba(16,24,40,0.04)',
        lift: '0 12px 32px rgba(6,59,73,0.10), 0 2px 6px rgba(16,24,40,0.06)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
