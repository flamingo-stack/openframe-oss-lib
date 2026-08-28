/**
 * Paths no linter should ever read, in any Flamingo frontend.
 *
 * Kept as a plain array (not a config object) so a consumer can spread it into
 * its own `globalIgnores([...ignores, 'my/local/path/**'])` instead of adding a
 * second ignores block — two blocks work, but only one of them shows up when
 * you debug with `--inspect-config`, which has cost people an afternoon before.
 */
export const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.vercel/**',
  '**/.yalc/**',
  '**/storybook-static/**',
  '**/public/**',
  '**/*.min.js',
  '**/*.tsbuildinfo',
  '**/next-env.d.ts',

  // Code generators own these. Linting them produces findings nobody can fix
  // in the source file the finding points at.
  '**/__generated__/**',
  '**/src/generated/**',
];

export default ignores;
