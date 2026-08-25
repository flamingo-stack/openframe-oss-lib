import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import perfectionist from 'eslint-plugin-perfectionist';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { ignores } from './ignores.js';

/**
 * Promote every `warn` in a third-party config to `error`.
 *
 * lint-spec §2.1: a human sees a yellow squiggle and thinks; an agent sees
 * `exit 0` and moves on. There is no third state — a rule is `error` or it is
 * `off`. Presets do not honour that: `eslint-config-next@16.3.2` ships 34 rules
 * at `warn`, including all 20 `@next/next/*` and 5 `jsx-a11y/*`. Left alone,
 * those rules do not exist as far as an agent is concerned.
 *
 * Done as a transform rather than a hand-written override block so a future
 * preset version cannot smuggle a new `warn` past us. Options are preserved.
 */
export function promoteWarnings(configs) {
  return configs.map(config => {
    if (!config.rules) return config;
    const rules = {};
    for (const [name, value] of Object.entries(config.rules)) {
      const severity = Array.isArray(value) ? value[0] : value;
      const isWarn = severity === 1 || severity === 'warn';
      if (!isWarn) {
        rules[name] = value;
      } else {
        rules[name] = Array.isArray(value) ? ['error', ...value.slice(1)] : 'error';
      }
    }
    return { ...config, rules };
  });
}

/**
 * The rule set every Flamingo frontend gets, framework-independent.
 *
 * Two rules govern what is in here, both from lint-spec:
 *
 *   §2.1 — no rule is ever `warn`: a rule is `error` or it is `off`. There is no
 *          suppressions baseline (drained and removed 2026-08-25), so a finding
 *          is either fixed or carried by a named `files:`-scoped block that
 *          states its reason. Do not soften a severity to get a green run.
 *   §2.6 — a rule earns its place by the bug it prevents. Style-only rules
 *          (`object-shorthand`, `prefer-template`, `no-implicit-coercion`) were
 *          removed on 2026-08-24 for failing that test.
 */
export const base = [
  { name: 'flamingo/ignores', ignores },

  {
    name: 'flamingo/linter-options',
    linterOptions: {
      // §3.1: inline suppression is forbidden outright, not "allowed with a
      // description". An agent whose cheapest path to a green run is a comment
      // will take it every time. `noInlineConfig` does not delete the
      // directives — it makes them inert — and
      // `reportUnusedDisableDirectives: 'error'` below then fails the build on
      // each one at ERROR severity. (It does not need `--max-warnings=0` to do
      // that; an earlier version of this note said it did.)
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    name: 'flamingo/base',
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.es2025 },
    },
    plugins: {
      import: importPlugin,
      perfectionist,
      'unused-imports': unusedImports,
    },
    rules: {
      // Replaces Biome's `assist.actions.source.organizeImports`. Deliberately
      // an ESLint rule and not a Prettier plugin: this way import order is
      // fixed by the same `source.fixAll.eslint` action as everything else, so
      // there is exactly one save-time actor and no ordering fight with the
      // formatter.
      //
      // Options reproduce Biome's ordering rather than the plugin's defaults,
      // because the one-time reordering commit is charged against real review
      // attention. Measured on openframe-frontend-core:
      //
      //   perfectionist as configured here   451 files, 2 411 diff lines
      //   biome organizeImports itself       638 files
      //   simple-import-sort (the default)   818 files, 3 917 diff lines
      //
      // The two options doing that work:
      //   newlinesBetween: 'ignore'  — Biome never inserts blank lines between
      //     groups; simple-import-sort does, which was +2 289 lines on its own.
      //   sortSideEffects: false     — `import './styles.css'` may not be moved
      //     across, because its position is execution order, not style.
      //
      // Note none of these is a zero-diff option: the assist was configured in
      // biome.json but never applied repo-wide, so the imports are not sorted
      // by anything today. Leaving Biome would have cost the largest diff.
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          ignoreCase: true,
          newlinesBetween: 'ignore',
          sortSideEffects: false,
          internalPattern: ['^@/.+'],
          groups: ['builtin', 'external', 'internal', 'parent', ['sibling', 'index'], 'unknown'],
        },
      ],
      // Export order is deliberately NOT enforced: Biome never sorted exports,
      // §2.6 asks what bug a rule prevents, and for export order the answer is
      // none. Dropping it removes 194 further changes from this library alone.

      // Biome's `correctness/noUnusedVariables`, split in two so the half that
      // can be fixed mechanically actually is. `@typescript-eslint/no-unused-vars`
      // has no fixer; `unused-imports/no-unused-imports` does, and an unused
      // import is never a deliberate act.
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // §3.3 — module boundaries. `no-cycle` is NOT here: it is graph-wide and
      // far too slow to sit in the fast pass, so it lives in ./cycles and runs
      // as its own CI step. `no-extraneous-dependencies` restores
      // parity with Biome's `noUndeclaredDependencies`, which was `error` in
      // every biome.json and was lost in the migration (45 findings in
      // multi-platform-hub).
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.{test,spec}.{js,mjs,cjs,jsx,ts,tsx}',
            '**/__tests__/**',
            '**/*.stories.{js,jsx,ts,tsx}',
            '**/.storybook/**',
            '**/scripts/**',
            '**/*.config.{js,mjs,cjs,ts,mts,cts}',
            // Test-runner bootstrap files sit next to the config but do not
            // match `*.config.*` — vitest.setup.ts, jest.setup.js, and friends.
            '**/*.setup.{js,mjs,cjs,jsx,ts,tsx,mts,cts}',
            '**/eslint-config/**',
          ],
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
      'import/no-duplicates': 'error',

      // Namespace imports are banned. `import * as React from 'react'` was the
      // shadcn/ui convention and it is 150 files in this library alone, but
      // with `jsx: "react-jsx"` React does not need to be in scope for JSX at
      // all — the namespace exists purely to reach the API, and
      // `React.useState` reads worse than `useState` while telling the reader
      // nothing extra. The bundle argument usually made here does not apply to
      // `react` itself; readability is the whole case, and it is enough.
      //
      // `@radix-ui/*` is exempt because there the namespace IS the documented
      // API surface (`<Dialog.Root>`, `<Dialog.Portal>`); rewriting it to named
      // imports would make the call sites worse, not better.
      //
      // Note the fixer is JS-oriented and bails whenever the namespace is used
      // in a type position, which is nearly always in TS — 3 of 165 findings
      // here are autofixable. The rest need a TS-aware codemod, so they sit in
      // the baseline until then.
      'import/no-namespace': ['error', { ignore: ['@radix-ui/*', 'node:*'] }],

      // Type-only specifiers are marked as such, inline, so one import
      // statement per module stays one statement:
      //   import { useState, type ReactNode } from 'react'
      // Paired with `no-import-type-side-effects`, which promotes the
      // all-types case to a top-level `import type` so bundlers can drop the
      // statement entirely instead of keeping it for its side effects.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: true },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // §3.4 — correctness rules worth keeping from the classic presets. Each
      // one names a real bug: a mutated argument that surprises the caller, a
      // `.map` callback that forgets to return, a function that returns a value
      // on one path and `undefined` on another, a shadowed binding read as the
      // outer one.
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-var': 'error',
      // props: true per § 3.4 ("включая свойства") — mutating `arg.foo` is the
      // form that actually surprises callers.
      //
      // The `[Rr]ef$` carve-out is not a softening: writing `.current` on a
      // parameter typed `MutableRefObject` IS that type's entire contract, and a
      // hook that takes a ref in order to fill it has no other way to say so.
      // The name suffix is the narrowest reliable signal, and a write to
      // `x.current` is never the accidental mutation this rule exists to catch.
      'no-param-reassign': ['error', { props: true, ignorePropertyModificationsForRegex: ['[Rr]ef$'] }],
      'array-callback-return': ['error', { allowImplicit: false, checkForEach: true }],
      'consistent-return': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-use-before-define': 'off',
      // functions: false — hoisted declarations used above their definition are
      // idiomatic and never a bug; the classes/variables cases are.
      '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
      'default-param-last': 'off',
      '@typescript-eslint/default-param-last': 'error',
      // Biome's `complexity/useLiteralKeys` has no type-free ESLint twin: the
      // stock `dot-notation` is fine, but its TS variant needs type info, so it
      // lives in ./type-checked instead of costing every repo a TS program.
      'dot-notation': ['error', { allowKeywords: true }],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      'no-dupe-class-members': 'off',
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-useless-constructor': 'off',
      eqeqeq: ['error', 'smart'],

      // §3.2 — a swallowed error is the single most expensive thing an agent
      // writes. `allowEmptyCatch` was set here until 2026-08-24 on the argument
      // that `catch {}` is a deliberate teardown idiom; the spec rejects that —
      // a logging convention belongs in a local rule (§5.2), not in a blanket
      // exemption that also covers every forgotten branch.
      'no-empty': 'error',

      // §3.1 — the escape hatches around the type checker. `ts-expect-error`
      // survives only with a real explanation; 20 characters is the threshold
      // that rejects "fix later" and "todo".
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
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/no-require-imports': 'error',

      // §3.5 — code injection. The one category with no debatable cases.
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // `no-console` is intentionally absent: the consuming repos hold ~4 000
      // console call sites between them and treat them as a supported logging
      // channel. Enabling it would bury every other finding. A repo that wants
      // it turns it on locally, scoped to directories it has actually cleaned.
    },
  },

  // typescript-eslint's scope analyser injects a synthetic reference to the JSX
  // pragma binding (`React` by default) into every file containing JSX. That is
  // what the classic runtime needed, and it is exactly why a dead
  // `import React from 'react'` walks straight past
  // `unused-imports/no-unused-imports`: the import looks used to every
  // unused-variable rule there is. Every repo on this config compiles with
  // `jsx: "react-jsx"` (automatic runtime), so nothing has to keep that binding
  // alive — `null` disables the injection and the dead imports become errors
  // with a fixer. Paired with `react/jsx-uses-react: 'off'` in ./next, which
  // does the same job from the eslint-plugin-react side.
  {
    name: 'flamingo/base/jsx-pragma',
    files: ['**/*.{jsx,tsx}'],
    languageOptions: { parserOptions: { jsxPragma: null } },
  },

  // Type declaration files describe other people's shapes; most of the base
  // rules are noise there.
  {
    name: 'flamingo/base/declarations',
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // A `.cjs` file exists precisely to use `require`. Flagging it is noise, and
  // `typescript-eslint/recommended` does exactly that by default.
  {
    name: 'flamingo/base/commonjs',
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Build scripts, config files and tests run in Node and legitimately reach
  // for `require` and throwaway locals.
  {
    name: 'flamingo/base/tooling',
    files: [
      '**/*.config.{js,mjs,cjs,ts,mts,cts}',
      '**/scripts/**/*.{js,mjs,cjs,ts}',
      '**/*.{test,spec}.{js,mjs,cjs,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,mjs,cjs,jsx,ts,tsx}',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'consistent-return': 'off',
    },
  },
];

export default base;
