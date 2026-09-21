#!/usr/bin/env node

/**
 * Refuses to publish a manifest that points at a local checkout.
 *
 * A `yalc add` run in the wrong directory once wrote
 * `"@flamingo-stack/openframe-frontend-core": "file:.yalc/..."` into this
 * package's OWN dependencies (c26d68fb). Locally that line is invisible - the
 * `.yalc/` folder exists there - but every consumer that installed the
 * published tarball had npm silently drop the whole library from its tree:
 * install exits 0, the lockfile shrinks, `node_modules/@flamingo-stack/` is
 * empty and the app no longer compiles.
 *
 * Runs from `prepublishOnly` and, because the PR-snapshot publish uses
 * `--ignore-scripts`, as an explicit workflow step too. Checks only what ships
 * to consumers: dependencies, peerDependencies, optionalDependencies.
 *
 * Usage: node scripts/check-publish-manifest.mjs [path/to/package.json]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

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

if (problems.length > 0) {
  console.error(`Refusing to publish ${manifest.name}@${manifest.version} (${manifestPath}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    'A yalc/file link leaked into the manifest - consumers could not install it. Remove the entry and retry.',
  );
  process.exit(1);
}

console.log(`Publish manifest OK: ${manifest.name}@${manifest.version} carries no local dependency specs.`);
