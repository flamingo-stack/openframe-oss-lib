#!/usr/bin/env node
/**
 * The fingerprint of everything a build of this package reads: every file under `src/`, and the configuration the
 * build runs with. ONE definition, used by both ends:
 *
 * - every build writes it into `dist/source-stamp.json` (`node scripts/source-stamp.mjs write`), so a copy of the
 *   package (a yalc snapshot in a consumer) says which sources it was built from;
 * - a consumer developing against a local checkout imports `sourceStamp` from HERE and compares: a snapshot whose
 *   stamp differs from the checkout's sources is stale, and is rebuilt instead of being used.
 *
 * Content, not file times or git: yalc copies only files whose content changed, so times say nothing, and an
 * uncommitted edit changes the build as much as a commit does.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** What a build reads besides `src/`. */
const BUILD_INPUTS = [
  'package.json',
  'tsup.config.ts',
  'tailwind.config.ts',
  'tsconfig.json',
  'tsconfig.declarations.json',
];

/** Where every build writes the stamp, inside the shipped `dist/`. */
export const SOURCE_STAMP_FILE = join('dist', 'source-stamp.json');

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

/** The fingerprint of the package at `root` (default: this package). */
export function sourceStamp(root = PACKAGE_ROOT) {
  const files = [
    ...filesUnder(join(root, 'src')),
    ...BUILD_INPUTS.map(name => join(root, name)).filter(path => existsSync(path)),
  ]
    .map(path => relative(root, path).split(sep).join('/'))
    .sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash
      .update(file)
      .update('\0')
      .update(
        createHash('sha256')
          .update(readFileSync(join(root, file)))
          .digest('hex'),
      )
      .update('\0');
  }
  return hash.digest('hex');
}

/** The stamp a built copy of the package carries, or null when it carries none. */
export function builtStamp(packageCopy) {
  try {
    return JSON.parse(readFileSync(join(packageCopy, SOURCE_STAMP_FILE), 'utf8')).stamp ?? null;
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'write') {
    console.log(sourceStamp());
  } else {
    const target = join(PACKAGE_ROOT, SOURCE_STAMP_FILE);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify({ stamp: sourceStamp() })}\n`);
  }
}
