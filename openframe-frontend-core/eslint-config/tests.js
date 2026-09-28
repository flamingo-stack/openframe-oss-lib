import vitest from '@vitest/eslint-plugin';
import testingLibrary from 'eslint-plugin-testing-library';

import { promoteWarnings } from './base.js';

/**
 * Test-file rules. Additive; spread after the framework layer.
 *
 * These pass §2.6 without argument: an un-awaited `findBy*` is a test that
 * passes while asserting nothing, `no-node-access` is a test coupled to markup
 * it should not see, `no-conditional-expect` is an assertion that may never
 * run. All three are bugs in the safety net itself, which is the worst place to
 * have one.
 *
 * `eslint-plugin-jest-dom` was tried on 2026-08-24 and removed. Every rule it
 * ships is a `prefer-*` — they improve failure messages, they do not catch
 * bugs, so §2.6 rejects them on its own. What settled it is that one of the
 * fixers is not semantics-preserving: it rewrote
 *
 *   expect(container.textContent).not.toContain(PREFIX)
 *   → expect(container).not.toHaveTextContent(new RegExp(PREFIX))
 *
 * which compiles the string as a pattern (unescaped) and normalises
 * whitespace. That broke one test outright and silently changed 37 more
 * assertions that happened to keep passing. An autofixer allowed to rewrite
 * assertions is the same failure mode §2.2 describes, just performed by the
 * tool instead of the agent.
 *
 * `vitest.configs.recommended` is exported in eslintrc shape, so only its
 * `rules` are spread and the plugin is registered here.
 */
export const tests = [
  ...promoteWarnings([
    {
      name: 'flamingo/tests',
      files: ['**/*.{test,spec}.{js,mjs,cjs,jsx,ts,tsx}', '**/__tests__/**/*.{js,mjs,cjs,jsx,ts,tsx}'],
      plugins: {
        vitest,
        'testing-library': testingLibrary,
      },
      settings: {
        // Turns OFF the plugin's "aggressive render reporting", which treats
        // ANY function whose lowercased name contains "render" as RTL's
        // `render`. That heuristic is wrong here: this repo's test helpers are
        // called `renderStable` (returns an HTMLElement), `renderHtml`
        // (returns a string) and `renderMarkdown` — none of them return a
        // render result, so `render-result-naming-convention` fired on the
        // variable holding their output and demanded it be renamed `view`.
        // With this off, only the exact name `render` counts; the real
        // `const result = render(ui)` inside those helpers is still caught.
        // Set this to an ARRAY of names if a genuine custom render wrapper
        // (`renderWithProviders`) is ever added — 'off' means none exist.
        'testing-library/custom-renders': 'off',
      },
      rules: {
        ...vitest.configs.recommended.rules,
        ...testingLibrary.configs['flat/react'].rules,

        // Vitest's `expect(actual, message)` is documented API, not a Jest
        // leftover — the second argument labels the assertion. The plugin
        // defaults to `maxArgs: 1` (Jest's signature), which turns the one
        // construct that makes a failure inside a `for` loop identifiable into
        // an error. Raised to 2; `minArgs` stays at the default 1.
        'vitest/valid-expect': ['error', { maxArgs: 2 }],

        // A test whose assertions live in a named helper (`assertEqualSets`,
        // `assertNoTabIndexTraps`) is not a test without assertions. The rule
        // matches on call name only — it cannot follow a function — so the
        // helper naming convention has to be declared. Anything called
        // `assert*` counts; the rule still fires on a genuinely empty test.
        'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'assert*'] }],

        // `javascript:` string literals are an XSS vector in shipped code and
        // nothing at all in a test file, where they are the payload the guard
        // under test is supposed to reject. Writing them obfuscated
        // (`['javascript', 'alert(1)'].join(':')`) to satisfy the linter makes
        // the security test harder to read than the risk it models.
        'no-script-url': 'off',

        // `next/image` exists to shrink what ships to a browser. A test file
        // ships nowhere, and the `<img>` here is usually a two-line mock
        // standing in for a real image component — routing it through the
        // embed shim would test the shim instead of the subject.
        '@next/next/no-img-element': 'off',
      },
    },
  ]),
];

export default tests;
