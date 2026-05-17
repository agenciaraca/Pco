import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'coverage', '.vercel', 'public/sw.js'] },
  {
    ...js.configs.recommended,
    files: ['**/*.{ts,tsx,js,jsx}'],
  },
  // Service worker context — usa self, caches, fetch como globals
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.browser },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        // Built-in types do TypeScript que ESLint não detecta automaticamente
        React: 'readonly',
        RequestInit: 'readonly',
        HeadersInit: 'readonly',
        NodeJS: 'readonly',
        ScrollBehavior: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Caracteres como ' " < > em JSX são OK — pt-BR cheio de aspas e apostrofos
      'react/no-unescaped-entities': 'off',
      // PT-BR às vezes tem nbsp em strings (intencional pra layout)
      'no-irregular-whitespace': 'warn',
      // Pequenas otimizações de TS — warning não bloqueia CI
      'no-useless-assignment': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      'no-useless-escape': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': 'warn',
      // react-hooks v6+: setState em useEffect é erro por padrão; muitos casos
      // legítimos no AVA. Marca como warn pra não bloquear CI.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
];
