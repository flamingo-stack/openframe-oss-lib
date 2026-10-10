/**
 * The library's ESM build: ONE output module per source module.
 *
 *   src/components/ui/button.tsx  →  dist/components/ui/button.js
 *
 * WHY. The ESM build used to be a bundle: every client entry (`components/ui`,
 * `components/chat`, `hooks`, …) was rolled into a few shared chunks, megabytes
 * each, with tree-shaking off (a bundler strips the `"use client"` banner the
 * chunks need). A consumer that imported one button therefore shipped the chat,
 * the markdown editor, the video player and the phone-number library with it:
 * its bundler cannot split a chunk that is already a single module. With one
 * module per source module, a consumer's bundler follows the imports a page
 * really makes and leaves the rest out.
 *
 * THE DIRECTIVE. A bundle carried `"use client"` as a banner on every client
 * chunk. Module by module, the same rule is stated per file:
 *
 *   - a module the SERVER entries reach (tsup.config.ts, first block: types,
 *     pure utils, schemas, the wire protocol) is server-safe and gets none;
 *   - a BARREL (a module that only re-exports) gets none either: see `isBarrel`;
 *   - every other module gets `"use client"`, as the banner gave it before.
 *
 * So a name imported from the lib is a client reference exactly when the module
 * that DEFINES it is a client module; only the size of what an import drags in
 * changes.
 *
 * SPECIFIERS. Source imports are extensionless (`./button`). Each relative (and
 * `@/`) specifier is rewritten to the file it names (`./button.js`,
 * `./ui/index.js`), so the output is valid for Node's ESM resolver as well as
 * for a bundler. One that names no source file fails the build.
 *
 * The CommonJS build is still tsup's bundle (`require` consumers, which do not
 * tree-shake, keep what they have). Declarations are still tsc's.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build, transform } from 'esbuild';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
/** What the published build leaves out (the same list `tsconfig.declarations.json` excludes). */
const EXCLUDED = [
  /\.test\.tsx?$/,
  /\.stories\.tsx?$/,
  /\.d\.ts$/,
  /(^|\/)__tests__\//,
  /(^|\/)__fixtures__\//,
  /^stories\//,
];
const USE_CLIENT = '"use client";';
const TARGET = 'es2020';

const toPosix = path => path.split(sep).join(posix.sep);

// The three statements a barrel is made of: `export … from`, `import … from`, and `export { … }` of what it imported.
const RE_EXPORT_FROM = /export\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'][^"']+["'];?/g;
const RE_IMPORT = /import\s+(?:[\w$\s,*]*(?:\{[^}]*\})?[\w$\s,*]*\s+from\s+)?["'][^"']+["'];?/g;
const RE_EXPORT_LIST = /export\s*\{[^}]*\};?/g;

/**
 * A barrel: a module that only re-exports other modules (`export … from`, or
 * an import followed by `export { … }`). It gets NO directive, whatever it
 * re-exports. With `"use client"` on it, a server component that imports one
 * name from the barrel makes the WHOLE barrel a client entry, and every module
 * it re-exports ships to the browser (the chat panel behind one icon helper).
 * Without it, the import resolves through to the module that defines the name,
 * and that module's own directive decides.
 */
function isBarrel(code) {
  const body = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/^\s*["']use client["'];?/, '');
  const exports = (body.match(RE_EXPORT_FROM) ?? []).length + (body.match(RE_EXPORT_LIST) ?? []).length;
  const rest = body.replace(RE_EXPORT_FROM, '').replace(RE_IMPORT, '').replace(RE_EXPORT_LIST, '');
  return exports > 0 && rest.trim() === '';
}

/** The tsup config's own entry lists: one owner for what is a server entry. */
async function loadTsupConfig() {
  const compiled = join(ROOT, '.tsup.config.esm-build.mjs');
  await build({
    entryPoints: [join(ROOT, 'tsup.config.ts')],
    outfile: compiled,
    bundle: true,
    packages: 'external',
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  try {
    return (await import(`${pathToFileURL(compiled).href}?t=${Date.now()}`)).default;
  } finally {
    rmSync(compiled, { force: true });
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Every source module the build publishes, as a `src`-relative posix path. */
function sourceModules() {
  return walk(SRC)
    .map(path => toPosix(relative(SRC, path)))
    .filter(rel => SOURCE_EXTENSIONS.some(ext => rel.endsWith(ext)) && !EXCLUDED.some(rule => rule.test(rel)))
    .sort();
}

/** The modules the server entries reach: bundle them in memory and read the graph. */
async function serverSafeModules(serverEntries) {
  const result = await build({
    entryPoints: serverEntries.map(entry => join(ROOT, entry)),
    bundle: true,
    write: false,
    metafile: true,
    packages: 'external',
    format: 'esm',
    jsx: 'automatic',
    target: TARGET,
    outdir: join(ROOT, '.unused'),
    tsconfig: join(ROOT, 'tsconfig.json'),
    logLevel: 'silent',
  });
  return new Set(
    Object.keys(result.metafile.inputs)
      .map(input => toPosix(relative(SRC, resolve(ROOT, input))))
      .filter(rel => !rel.startsWith('..')),
  );
}

/** The source module a specifier names, as a `src`-relative posix path; null when it names none. */
function resolveSpecifier(specifier, fromRel, modules) {
  const base = specifier.startsWith('@/')
    ? specifier.slice(2)
    : posix.normalize(posix.join(posix.dirname(fromRel), specifier));
  for (const candidate of [
    ...SOURCE_EXTENSIONS.map(ext => `${base}${ext}`),
    ...SOURCE_EXTENSIONS.map(ext => `${base}/index${ext}`),
  ]) {
    if (modules.has(candidate)) return candidate;
  }
  return null;
}

const outputPathOf = rel => rel.replace(/\.tsx?$/, '.js');

/** `./button` → `./button.js`: every specifier that names one of our modules, in the three forms an import takes. */
function rewriteSpecifiers(code, fromRel, modules, unresolved) {
  const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])((?:\.{1,2}\/|@\/)[^"']*|\.{1,2})\2/g;
  return code.replace(SPECIFIER, (match, lead, quote, specifier) => {
    const target = resolveSpecifier(specifier, fromRel, modules);
    if (!target) {
      unresolved.push(`${fromRel}: ${specifier}`);
      return match;
    }
    let rewritten = posix.relative(posix.dirname(outputPathOf(fromRel)), outputPathOf(target));
    if (!rewritten.startsWith('.')) rewritten = `./${rewritten}`;
    return `${lead}${quote}${rewritten}${quote}`;
  });
}

async function main() {
  const started = Date.now();
  const [serverBlock] = await loadTsupConfig();
  const entries = Object.values(serverBlock.entry);
  // The one server entry outside `src` (the Tailwind config) stays a bundle of its own.
  const outsideSrc = entries.filter(entry => !toPosix(entry).replace(/^\.\//, '').startsWith('src/'));
  const serverSafe = await serverSafeModules(entries.filter(entry => !outsideSrc.includes(entry)));

  const modules = sourceModules();
  const known = new Set(modules);
  const unresolved = [];
  let clientModules = 0;
  let barrels = 0;

  await Promise.all(
    modules.map(async rel => {
      const source = readFileSync(join(SRC, rel), 'utf8');
      const { code } = await transform(source, {
        loader: rel.endsWith('.tsx') ? 'tsx' : 'ts',
        format: 'esm',
        jsx: 'automatic',
        target: TARGET,
        sourcefile: rel,
      });
      let output = rewriteSpecifiers(code, rel, known, unresolved);
      if (isBarrel(output)) {
        barrels += 1;
        // A barrel written with its own directive in the source loses it here, for the same reason.
        output = output.replace(/^\s*["']use client["'];?\s*/, '');
      } else if (!serverSafe.has(rel)) {
        clientModules += 1;
        if (!/^\s*["']use client["']/.test(output)) output = `${USE_CLIENT}\n${output}`;
      }
      const target = join(DIST, outputPathOf(rel));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, output);
    }),
  );

  if (unresolved.length > 0) {
    throw new Error(
      `build-esm-modules: ${unresolved.length} import(s) name no source module:\n  ${unresolved.slice(0, 30).join('\n  ')}`,
    );
  }

  for (const entry of outsideSrc) {
    await build({
      entryPoints: [join(ROOT, entry)],
      outfile: join(
        DIST,
        toPosix(entry)
          .replace(/^\.\//, '')
          .replace(/\.tsx?$/, '.js'),
      ),
      bundle: true,
      packages: 'external',
      format: 'esm',
      target: TARGET,
      logLevel: 'silent',
    });
  }

  if (!existsSync(join(DIST, 'index.js'))) throw new Error('build-esm-modules: dist/index.js was not written');
  console.log(
    `ESM modules: ${modules.length} written (${clientModules} client, ${barrels} barrels, ${modules.length - clientModules - barrels} server-safe) in ${Date.now() - started}ms`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
