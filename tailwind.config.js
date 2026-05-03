/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pco: {
          blue: '#0097B2',
          cyan: '#0CC0DF',
          'cyan-light': '#5CE1E6',
          orange: '#FE9002',
          deep: '#063B49',
          graphite: '#101828',
        },
        surface: {
          white: '#FFFFFF',
          off: '#F8FCFD',
          gray: '#EEF5F7',
        },
        ink: {
          base: '#101828',
          muted: '#475467',
          subtle: '#98A2B3',
        },
        status: {
          success: '#16A34A',
          danger: '#D92D20',
          warning: '#F59E0B',
          gold: '#D6A84F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
