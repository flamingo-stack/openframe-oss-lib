import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

import { base, promoteWarnings } from './base.js';

/**
 * Next.js applications: `base` plus the Next/React/a11y/import stack.
 *
 * Requires `next` to be installed in the consuming project — `eslint-config-next`
 * loads its parser from `next/dist/compiled/babel/eslint-parser`, so importing
 * this entry point without Next present fails at config load, not at lint time.
 *
 * Both Next configs go through `promoteWarnings` (§2.1): between them they ship
 * 25 rules at `warn` — every `@next/next/*` rule and 5 of the 6 `jsx-a11y`
 * ones. §3.6 is explicit that accessibility rules must not be softened to work
 * around framework quirks, and a preset-supplied `warn` is exactly that
 * softening, just not written by us.
 *
 * Ordering: `base` first, then the Next configs (they carry
 * `typescript-eslint/recommended` of their own), then the corrections block,
 * which must come last to win.
 */
export const next = [
  ...base,
  ...promoteWarnings(nextCoreWebVitals),
  ...promoteWarnings(nextTypescript),

  // `base`'s severities have to be restated after the presets: both Next
  // configs re-declare the `typescript-eslint/recommended` set, and spread
  // later they win. Same reason the CommonJS exemption is repeated below.
  {
    name: 'flamingo/next/severities',
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 20,
        },
      ],
    },
  },

  // Restated after the presets for the same reason the severities are:
  // `eslint-config-next/typescript` re-declares the parser for ts/tsx and its
  // `parserOptions` win when spread later, taking `jsxPragma` back to its
  // default. See ./base `flamingo/base/jsx-pragma` for why it must be null.
  {
    name: 'flamingo/next/jsx-pragma',
    files: ['**/*.{jsx,tsx}'],
    languageOptions: { parserOptions: { jsxPragma: null } },
  },

  {
    name: 'flamingo/next/commonjs',
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    name: 'flamingo/next',
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      // Off since 2026-08-24. `react/jsx-uses-react` exists for one purpose: to
      // mark the `React` binding as used in any file containing JSX, so that
      // `no-unused-vars` does not flag the import the classic JSX transform
      // required. Every repo on this config sets `jsx: "react-jsx"` (automatic
      // runtime) and already runs with `react/react-in-jsx-scope` off, so the
      // rule's only remaining effect is to hide dead `import React from 'react'`
      // lines from `unused-imports/no-unused-imports` — 169 of them across the
      // three repos when this was turned off. With it off they are errors, and
      // `--fix` removes them.
      'react/jsx-uses-react': 'off',

      // Off since 2026-08-25. This is not a defect report — it is React
      // Compiler telling you it declined to memoize a component because a
      // third-party hook (`useReactTable`) returns functions it cannot prove
      // stable. There is no edit that clears it short of dropping the library,
      // so at `error` it is a permanent baseline entry that never shrinks, and
      // §2.6 rules out anything that reports a missed optimisation rather than
      // a bug. The correctness half of the react-hooks v7 family (refs,
      // purity, set-state-in-effect, immutability) stays at `error`.
      'react-hooks/incompatible-library': 'off',

      // Off since 2026-08-24. Apostrophes and quotes in user-facing copy: every
      // hit is a false positive on a string a designer wrote, and the fix
      // (`&apos;`) makes the source harder to read than the problem it solves.
      // Revisit if the repos ever render untrusted copy through JSX text.
      'react/no-unescaped-entities': 'off',

      // The react-hooks v7 correctness family (set-state-in-effect, refs,
      // purity, immutability, preserve-manual-memoization, static-components)
      // is left at the plugin's own `error`. Across the four repos these fire
      // 828 times and every sample inspected was a genuine render-correctness
      // bug — 78% of all blocking findings, and the single strongest argument
      // for ESLint over Biome.
    },
  },
];

export default next;
