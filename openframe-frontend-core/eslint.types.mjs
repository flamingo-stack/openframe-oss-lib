import { defineConfig, globalIgnores } from 'eslint/config';

import prettierCompat from './eslint-config/prettier-compat.js';
import typeChecked from './eslint-config/type-checked.js';
import base from './eslint.config.mjs';

/*
 * The type-aware pass — lint-spec §2.4, run as its own stage per §7.2.
 * Extends the fast config rather than restating it.
 *
 * Needs `NODE_OPTIONS=--max-old-space-size=8192`: with the default heap the run
 * dies of OOM at 4 GB after a minute. See `npm run lint:types`.
 *
 * The ignores below are not exemptions — every one of these files is still
 * linted by the fast pass. They are simply outside the TypeScript project
 * (tsconfig.json includes only the src tree and excludes the stories folder), so
 * `projectService` cannot build a program for them and reports a parse error
 * instead of a finding: 157 of them on the first run. §9 asks that type-aware
 * linting reach files outside the main tsconfig; that is what `projectService`
 * does for the ones that have a project at all. Stories and the vitest setup
 * are deliberately out of the shipped build, so there is nothing to reach.
 */
export default defineConfig([
  globalIgnores([
    'src/stories/**',
    'vitest.setup.ts',
    'vitest.config.ts',
    'tsup.config.ts',
    'tailwind.config.ts',
    'prettier.config.mjs',
    'eslint.*.mjs',
    'eslint.config.mjs',
    'eslint-config/**',
    'scripts/**',
    '.storybook/**',
  ]),
  ...base,
  ...typeChecked,
  // Re-applied because typeChecked lands after the fast config's copy.
  ...prettierCompat,
]);
