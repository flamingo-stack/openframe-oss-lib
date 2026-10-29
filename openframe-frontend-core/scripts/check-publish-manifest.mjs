#!/usr/bin/env node

/**
 * Refuses to publish a package its consumers cannot use: a manifest that points at a local
 * checkout, or a CommonJS entry that fails to load.
 *
 * A `yalc add` run in the wrong directory once wrote
 * `"@flamingo-stack/openframe-frontend-core": "file:.yalc/..."` into this
 * package's OWN dependencies (c26d68fb). Locally that line is invisible - the
 * `.yalc/` folder exists there - but every consumer that installed the
 * published tarball had npm silently drop the whole library from its tree:
 * install exits 0, the lockfile shrinks, `node_modules/@flamingo-stack/` is
 * empty and the app no longer compiles.
 *
 * Every `require` target of `exports` must load, because consumers that `require` the package
 * (the hub's build scripts under `tsx`, Jest, plain Node) get the CommonJS build and nothing
 * else exercises it: 0.0.745 shipped 15 entries that threw on load (`_remark.remark.call is not
 * a function`; a unified processor called through the bundler's `.call(void 0)`), the type check
 * and the tests passed, and the hub's build was the first thing to load them.
 *
 * Runs from `prepublishOnly` and, because the PR-snapshot publish uses
 * `--ignore-scripts`, as an explicit workflow step too, after `npm run build`. The manifest check
 * looks only at what ships to consumers: dependencies, peerDependencies, optionalDependencies.
 *
 * Usage: node scripts/check-publish-manifest.mjs [path/to/package.json]
 */

import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';

const SHIPPED_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];
/** Specs that only resolve on the machine they were written on. */
const LOCAL_SPEC = /^(file|link|workspace):|\.yalc\//;

const manifestPath = resolve(process.argv[2] ?? 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const problems = [];
for (const field of SHIPPED_FIELDS) {
  for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
    if (name === manifest.name) {
      problems.push(`${field}: "${name}" depends on itself (${spec})`);
    } else if (LOCAL_SPEC.test(String(spec))) {
      problems.push(`${field}: "${name}" points at a local checkout (${spec})`);
    }
  }
}

/** Each concrete JavaScript `require` target of `exports` (a `*` pattern names no file; CSS is not code). */
function requireTargets(exportsField) {
  return Object.entries(exportsField ?? {})
    .map(([subpath, target]) => [subpath, typeof target === 'object' && target !== null ? target.require : null])
    .filter(([, file]) => typeof file === 'string' && !file.includes('*') && /\.c?js$/.test(file));
}

const requireFromPackage = createRequire(manifestPath);
for (const [subpath, file] of requireTargets(manifest.exports)) {
  try {
    requireFromPackage(file);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    problems.push(`exports["${subpath}"].require (${file}) does not load: ${message}`);
  }
}

/**
 * Every file an `exports` condition names must exist: `require` is loaded above, but a missing `import` or `types` file
 * fails only in a consumer (an ESM config, a type check). 0.0.804 shipped `./image-sizes` with only its `.cjs`: the ESM
 * and declaration builds mirror `src/`, so they wrote `dist/styles/image-sizes.*` while the map named `dist/`.
 */
const packageDir = dirname(manifestPath);
for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
  if (typeof target !== 'object' || target === null) continue;
  for (const [condition, file] of Object.entries(target)) {
    if (typeof file !== 'string' || file.includes('*')) continue;
    if (!existsSync(resolve(packageDir, file)))
      problems.push(`exports["${subpath}"].${condition} (${file}) is not built`);
  }
}

if (problems.length > 0) {
  console.error(`Refusing to publish ${manifest.name}@${manifest.version} (${manifestPath}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    'Consumers could not install or load this package. Remove a leaked yalc/file link, or fix the entry that does not load (run `npm run build` first).',
  );
  process.exit(1);
}

console.log(
  `Publish manifest OK: ${manifest.name}@${manifest.version} carries no local dependency specs, every file its exports name is built, and every CommonJS entry loads.`,
);
