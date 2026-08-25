import reactHooks from 'eslint-plugin-react-hooks';

import { base, promoteWarnings } from './base.js';

/**
 * React without Next: Vite/Tauri apps.
 *
 * Uses `eslint-plugin-react-hooks` directly rather than going through
 * `eslint-config-next`, which would drag in the `@next/next` rules (dead weight
 * outside a Next app) and a hard requirement on `next` being installed.
 *
 * The flat entry lives at `configs.flat['recommended-latest']`. The top-level
 * `configs['recommended-latest']` is still the eslintrc shape — it carries
 * `plugins: ['react-hooks']` as an array of strings, which flat config rejects
 * outright with "A config object has a 'plugins' key defined as an array".
 *
 * `recommended-latest` rather than `recommended`: it is the v7 set including
 * the React Compiler-derived correctness rules (set-state-in-effect, refs,
 * purity, immutability), not just rules-of-hooks/exhaustive-deps.
 */
export const react = [
  ...base,
  ...promoteWarnings([reactHooks.configs.flat['recommended-latest']]),

  {
    name: 'flamingo/react',
    files: ['**/*.{jsx,tsx}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  {
    // Every extension, not just jsx/tsx: hooks live in plain `.ts` files.
    // Kept in step with the identical block in ./next — see there for why this
    // one rule of the v7 family is off while the correctness half stays at
    // `error`.
    name: 'flamingo/react/severities',
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: { 'react-hooks/incompatible-library': 'off' },
  },
];

export default react;
