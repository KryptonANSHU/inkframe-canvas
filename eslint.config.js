import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      // `const { key, ...rest } = obj` is how readonly data drops a key without mutating.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-console': 'error',
      // Named exports only. Config files that need a default export opt out below.
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],
    },
  },

  {
    files: ['src/**/*.tsx'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },

  // The editor core and the plugin host are plain TypeScript: never React or the UI layer.
  {
    files: ['src/core/**/*.{ts,tsx}', 'src/plugins/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'src/core must not import React.',
            },
            { group: ['**/ui', '**/ui/**'], message: 'src/core must not import from src/ui.' },
            {
              group: ['@inkframe/design'],
              message: 'The design package exports React components; import design/tokens.',
            },
          ],
        },
      ],
    },
  },
  // The design system knows nothing of the editor: no core, no app UI.
  {
    files: ['src/design/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/core', '**/core/**'], message: 'src/design must not import src/core.' },
            { group: ['**/ui', '**/ui/**'], message: 'src/design must not import src/ui.' },
          ],
        },
      ],
    },
  },
  // JSX compiles to an implicit react/jsx-runtime import, which the import ban above can't see.
  {
    files: ['src/core/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
        { selector: 'JSXElement, JSXFragment', message: 'src/core must not contain JSX.' },
      ],
    },
  },

  {
    files: ['*.config.{js,ts}', 'bench/*.config.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Sample plugins run in the sandbox, where the SDK provides `inkframe`.
  {
    files: ['src/plugins/samples/*.js'],
    languageOptions: { globals: { ...globals.browser, inkframe: 'readonly' } },
  },
);
