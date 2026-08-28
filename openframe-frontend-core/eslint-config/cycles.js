import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/**
 * Circular-import detection — its own layer, run as its own CI step.
 *
 * §3.3 requires cyclic imports to be an error and caps `maxDepth` at 3 on cost
 * grounds. That cap is the shared default here; a repo that measures the rule
 * as cheap should raise it locally, because a cycle seven hops long is no less
 * of a cycle than one at depth two.
 *
 * Two things about this layer have already misled people, so they are recorded
 * here rather than re-derived:
 *
 *   - An early run reported 51 cycles at `maxDepth: 8`. They were counted before
 *     `unused-imports/no-unused-imports` deleted 54 unused imports from the
 *     package. An unused import is still an edge in the graph, and removing
 *     those edges is what removed most of those cycles.
 *   - The run that replaced it reported ZERO — because the consuming config
 *     spread this layer standalone instead of over the base config, and in that
 *     shape the plugin cannot build an export graph at all. A green check that
 *     examines nothing looks exactly like a passing one. Any `eslint.*.mjs`
 *     that adds this layer must spread the base config first.
 *
 * Findings, when there are any, are real architecture debt — not lint noise.
 */
export const cycles = [
  {
    name: 'flamingo/cycles',
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    // The parser is not optional here. This layer is spread standalone, so
    // without it every TS file dies on "Parsing error: Unexpected token :" —
    // and a parse error is not suppressible, so the pass reports thousands of
    // failures and finds zero cycles while looking like it ran.
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { import: importPlugin },
    settings: {
      // Load-bearing, not boilerplate. Without a resolver `eslint-plugin-import`
      // falls back to Node resolution, which cannot follow extensionless `./foo`
      // imports of `.ts`/`.tsx` files: 3 719 of this package's imports fail to
      // resolve. `no-cycle` then walks an almost empty graph and reports
      // nothing — the check passes while examining nothing, which is worse than
      // not having it at all.
      //
      // It has to be the `import/resolver` key. `import/resolver-next` (the
      // flat-config array form) belongs to `eslint-plugin-import-x`;
      // `eslint-plugin-import` ignores it silently, which is indistinguishable
      // from configuring nothing — measured: 3 719 unresolved either way,
      // 0 with the key below.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'import/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }],
    },
  },
];

export default cycles;
