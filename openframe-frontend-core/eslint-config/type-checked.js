import tseslint from 'typescript-eslint';

/**
 * Type-aware rules. **Required**, not optional — lint-spec §2.4.
 *
 * Kept as a separate layer only because it needs a tsconfig that covers the
 * linted files; every consumer must spread it.
 *
 * ## Why an explicit list and not `strictTypeChecked`
 *
 * Measured on this library (1 361 files): the full `strictTypeChecked` preset
 * reports **5 528 errors**, but its four most expensive rules are ones the spec
 * never asks for — `no-confusing-void-expression` (632),
 * `no-deprecated` (604), `restrict-template-expressions` (455),
 * `no-unnecessary-condition` (433). The set below is what §3.1, §3.2, §3.4 and
 * §3.5 actually require: ~1 451 findings, 26% of the preset's cost. §5.1 says
 * it in general — take a smaller base and add rules explicitly.
 *
 * ## What it costs
 *
 * The price is the TypeScript program, not the rules: once `projectService` is
 * on, adding more type-aware rules is nearly free. Building that program is what
 * makes this layer an order of magnitude slower than the fast pass, and it needs
 * `--max-old-space-size=8192` — with the default heap the run dies of OOM at
 * 4 GB. Any script or CI step that spreads this layer must set NODE_OPTIONS.
 */
export const typeChecked = [
  {
    name: 'flamingo/type-checked',
    files: ['**/*.{ts,mts,cts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // §9 requires type-aware linting to reach files outside the main
        // tsconfig too; projectService does that without a second config.
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // §3.2 — asynchrony. The highest-yield block in the whole spec: 117
      // findings here against 1 338 for §3.1 below, and every one is a lost
      // `await`, i.e. a race an agent wrote without noticing.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      // 'in-try-catch', never a flat ban: `return await` inside try/catch is
      // what keeps the frame in the stack trace. §4 lists the flat ban as a
      // known mistake.
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
      'require-atomic-updates': 'error',

      // §3.1 — the unsafe family, taken whole. Half of it is useless: closing
      // `any` while leaving `!` just moves the escape route, and the spec says
      // so explicitly.
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

      // §3.5 — the type-aware half of the injection set.
      'no-implied-eval': 'off',
      '@typescript-eslint/no-implied-eval': 'error',

      // §3.4 — full Biome `useLiteralKeys` parity; the TS-aware variant also
      // flags `obj['literal']` against a typed index signature.
      'dot-notation': 'off',
      '@typescript-eslint/dot-notation': 'error',
    },
  },
];

export default typeChecked;
