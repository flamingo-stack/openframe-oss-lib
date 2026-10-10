#!/usr/bin/env node

/**
 * Writes `dist/build/export-map.json`: for every entry of the package
 * (`…/components/ui`, `…/utils`, …), where each name it exports is DEFINED.
 *
 *   { "package": "<name>",
 *     "entries": { "./components/ui": { "Button": ["dist/components/ui/button.js", "Button"], … } } }
 *
 * WHY. An entry is a barrel: it re-exports hundreds of modules. A bundler drops
 * the ones a CLIENT file does not use. A SERVER file is different: every
 * `"use client"` module the server's import graph reaches is registered and
 * shipped with the page, used or not. So `import { Button } from '…/components/ui'`
 * in one server file sent the chat panel, the date picker and the markdown
 * editor to every page (measured: a page's scripts halved once seven such
 * imports named their modules). With this map a consumer's build rewrites the
 * import to the module that defines the name (`optimize-imports-loader.cjs`,
 * copied beside the map), so no call site changes and no rule has to be kept.
 *
 * Read from the ESM modules `build-esm-modules.mjs` just wrote, so it describes
 * exactly what is published. A name that cannot be traced to one module is left
 * out: the loader then leaves that import as it is.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(DIST, 'build');

const strip = code => code.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const RE_EXPORT_FROM = /export\s*(\*(?:\s*as\s+([\w$]+))?|\{([^}]*)\})\s*from\s*["']([^"']+)["'];?/g;
const RE_IMPORT_FROM = /import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["'];?/g;
const RE_EXPORT_LIST = /export\s*\{([^}]*)\}\s*;?(?!\s*from)/g;
const RE_EXPORT_DECL = /export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/g;

const modules = new Map();

/** `a, b as c` → [[a, a], [b, c]] (local name, then the name it goes out under). */
function specifiers(list) {
  return list
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [from, to] = part.split(/\s+as\s+/).map(name => name.trim());
      return [from, to ?? from];
    });
}

/** One module's exports: where each name comes from, and the modules it re-exports whole. */
function read(file) {
  if (modules.has(file)) return modules.get(file);
  const info = { own: new Set(), forwarded: new Map(), stars: [], barrel: false };
  modules.set(file, info);
  if (!existsSync(join(ROOT, file))) return info;
  const code = strip(readFileSync(join(ROOT, file), 'utf8')).replace(/^\s*["']use client["'];?/, '');
  const resolve = specifier => (specifier.startsWith('.') ? posix.join(posix.dirname(file), specifier) : null);

  const imported = new Map();
  for (const [, defaultName, named, specifier] of code.matchAll(RE_IMPORT_FROM)) {
    const target = resolve(specifier);
    if (!target) continue;
    if (defaultName) imported.set(defaultName, [target, 'default']);
    for (const [from, local] of specifiers(named ?? '')) imported.set(local, [target, from]);
  }
  for (const [, star, namespace, named, specifier] of code.matchAll(RE_EXPORT_FROM)) {
    const target = resolve(specifier);
    if (!target) continue;
    if (named !== undefined) for (const [from, to] of specifiers(named)) info.forwarded.set(to, [target, from]);
    else if (star && !namespace) info.stars.push(target);
  }
  for (const [, list] of code.matchAll(RE_EXPORT_LIST)) {
    for (const [local, to] of specifiers(list)) {
      if (imported.has(local)) info.forwarded.set(to, imported.get(local));
      else info.own.add(to);
    }
  }
  for (const [, name] of code.matchAll(RE_EXPORT_DECL)) info.own.add(name);
  if (/export\s+default\b/.test(code)) info.own.add('default');

  const rest = code.replace(RE_EXPORT_FROM, '').replace(RE_IMPORT_FROM, '').replace(RE_EXPORT_LIST, '');
  info.barrel = rest.trim() === '' && info.own.size === 0 && (info.forwarded.size > 0 || info.stars.length > 0);
  return info;
}

/** Every name `file` exports (default excluded from a star, as the language has it). */
function exportedNames(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const info = read(file);
  const names = new Set([...info.own, ...info.forwarded.keys()]);
  for (const star of info.stars) for (const name of exportedNames(star, seen)) if (name !== 'default') names.add(name);
  return names;
}

/** The module that defines `name` as `file` exports it: through barrels, stopping at the first module with code. */
function define(file, name, seen = new Set()) {
  const key = `${file}#${name}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const info = read(file);
  if (!info.barrel) return exportedNames(file).has(name) ? [file, name] : null;
  if (info.forwarded.has(name)) {
    const [target, from] = info.forwarded.get(name);
    return define(target, from, seen) ?? [target, from];
  }
  // Several stars may carry one name (two barrels re-exporting the same module): fine when they all
  // lead to one definition, ambiguous otherwise, and then the name is left to the barrel.
  const found = info.stars
    .filter(star => exportedNames(star).has(name))
    .map(star => define(star, name, new Set(seen)) ?? [star, name]);
  const distinct = new Set(found.map(([target, exported]) => `${target}#${exported}`));
  return distinct.size === 1 ? found[0] : null;
}

function main() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const entries = {};
  let names = 0;
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    const file = typeof target === 'object' && target ? target.import : null;
    if (typeof file !== 'string' || !file.endsWith('.js') || file.includes('*')) continue;
    const entryFile = posix.normalize(file);
    if (!read(entryFile).barrel) continue;
    const map = {};
    for (const name of [...exportedNames(entryFile)].sort()) {
      const defined = define(entryFile, name);
      if (defined && defined[0] !== entryFile) map[name] = defined;
    }
    if (Object.keys(map).length > 0) {
      entries[subpath] = map;
      names += Object.keys(map).length;
    }
  }
  if (names === 0) throw new Error('build-export-map: no entry exports a traceable name');
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'export-map.json'), `${JSON.stringify({ package: pkg.name, entries })}\n`);
  copyFileSync(join(ROOT, 'scripts', 'optimize-imports-loader.cjs'), join(OUT_DIR, 'optimize-imports-loader.cjs'));
  console.log(`Export map: ${names} names over ${Object.keys(entries).length} entries`);
}

main();
