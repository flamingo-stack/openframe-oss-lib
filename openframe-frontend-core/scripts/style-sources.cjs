/**
 * The files a Next.js app's pages really reach, for Tailwind's `content`.
 *
 *   const { appStyleSources } = require('<package>/style-sources')
 *   content: appStyleSources({ root: __dirname, appDir: 'app', firstPaint: true })   // the page's sheet
 *   content: appStyleSources({ root: __dirname, appDir: 'app' })                     // the full sheet
 *
 * WHY. Tailwind writes one rule for every class name it finds in `content`, and an app that lists
 * this library's whole `dist` gets a rule for every class of every component the library ships:
 * the chat, the markdown editor, the admin tables, whether or not a page renders them. On the hub
 * that was 299 KB of a 366 KB stylesheet, and the stylesheet blocks every page's first paint.
 *
 * WHAT. Every route file of the App Router (`page`, `layout`, `template`, `loading`, `error`,
 * `not-found`, `default`) is an entry, and the import graph is walked from them the way the app's
 * bundler walks it (esbuild, in memory, nothing written): the app's own modules and this library's
 * per-module ESM build, tree-shaken, so a barrel's unused re-exports are left out exactly as the
 * app's bundle leaves them out (the library declares no side effects but its CSS). Every other
 * package is external: it ships no Tailwind classes of the app's. What is not imported is not
 * scanned, so a new page, component or library module is in the stylesheet the moment something
 * imports it, with no list to keep.
 *
 * The library resolves from `node_modules`, the way a production build resolves it: a tsconfig
 * `paths` alias that points the package at a source checkout is ignored here.
 *
 * Options:
 *   root       the app's directory (absolute).
 *   appDir     the App Router directory, relative to root ('app', 'src/app').
 *   exclude    route directories under appDir whose files are not entries ('admin'): their own
 *              layout imports their own stylesheet.
 *   routes     which routes this build serves, for an app that builds several sites from one tree:
 *              { module, export, args } names a function of the app's (`(…args, path) => boolean`),
 *              called with each page's path ('/blog/x' for 'app/blog/[slug]/page.tsx'). A page it
 *              refuses is not an entry, nor is a layout or loading file with no served page under it.
 *   alias      bare specifier → file relative to root, for build-time aliases the bundler config
 *              states (Turbopack's resolveAlias).
 *   firstPaint true for the stylesheet a page BLOCKS on: the library's lazily loaded panels
 *              (`LAZY_STYLED`) are not followed, because each loads the app's full stylesheet itself
 *              when it opens (`EmbeddableChat`'s `loadStyles`). The full stylesheet is the same call
 *              without `firstPaint` and without `exclude`: it holds every class the first-paint one
 *              holds, so whichever of the two a page loads last, every element keeps Tailwind's order.
 *
 * A static list of files is what Tailwind's `content` takes, so in `next dev` a NEW file is in the
 * stylesheet after the dev server restarts; edits to a file already listed are picked up live.
 *
 * Tailwind loads its config synchronously and esbuild runs plugins only in its asynchronous API, so
 * the walk runs in a child process this call waits for (a few seconds, once per process).
 */
const { execFileSync } = require('node:child_process');
const { existsSync, readdirSync, realpathSync, rmSync, statSync } = require('node:fs');
const { dirname, isAbsolute, join, relative, resolve, sep } = require('node:path');

/** This package's directory: the nearest package.json up from here (`scripts/` in the repo, `dist/build/` installed). */
function packageDir() {
  for (let dir = __dirname; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    if (dirname(dir) === dir) throw new Error('style-sources: no package.json above this file');
  }
}
const PACKAGE_DIR = packageDir();
const PACKAGE = require(join(PACKAGE_DIR, 'package.json')).name;
const ROUTE_FILE =
  /^(page|layout|template|loading|error|not-found|default|global-error|global-not-found)\.[cm]?[jt]sx?$/;
/**
 * The library's modules that load on their own, after the page, and call the host's `loadStyles`
 * when they do. Only these leave the first-paint stylesheet: a lazily loaded module that does not
 * bring the full stylesheet with it must keep its classes in the one the page loads.
 */
const LAZY_STYLED = ['dist/components/chat/embeddable-chat.js'];
/** What the walk reads: code (and JSON, which code imports). Every other import (a stylesheet, an image, a
 * font) holds no class name and is loaded as an empty module, so nothing has to name its extension. */
const CODE = /\.(?:[cm]?[jt]sx?|json)$/;
const codeOnly = {
  name: 'code-only',
  setup(builder) {
    builder.onLoad({ filter: /.*/ }, args => (CODE.test(args.path) ? undefined : { contents: '', loader: 'empty' }));
  },
};

/** Route files under `dir`, skipping private folders (`_x`), API routes and the excluded directories. */
function routeFiles(appRoot, dir, exclude, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const rel = relative(appRoot, path).split(sep).join('/');
      if (name.startsWith('_') || name === 'api' || exclude.includes(rel)) continue;
      routeFiles(appRoot, path, exclude, out);
    } else if (ROUTE_FILE.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * The paths a route directory answers, as the filter is asked about them: a sample path with each
 * dynamic segment filled ('/blog/x'), and for a dynamic route the static part before its first
 * dynamic segment ('/blog', '/' for 'app/(landing)/[slug]'), because a dynamic route serves every path
 * under it and a filter that lists exact paths ('/ai-copilots-for-msps') knows none of them as '/x'.
 */
function routePaths(appRoot, dir) {
  const segments = relative(appRoot, dir)
    .split(sep)
    .filter(segment => segment && !/^\(.*\)$/.test(segment) && !segment.startsWith('@'));
  const firstDynamic = segments.findIndex(segment => segment.startsWith('['));
  const sample = `/${segments.map(segment => (segment.startsWith('[') ? 'x' : segment)).join('/')}`;
  if (firstDynamic === -1) return [sample];
  return [sample, `/${segments.slice(0, firstDynamic).join('/')}`];
}

const isPage = file => /^page\.[cm]?[jt]sx?$/.test(file.slice(file.lastIndexOf(sep) + 1));

/**
 * The route files this build serves: every page the filter accepts at one of its paths (`routePaths`),
 * and every other route file (layout, loading, error, …) that sits on the path to one. When in doubt a
 * page is kept: a page kept for nothing costs bytes, a page dropped costs its styles.
 */
function servedRouteFiles(appRoot, files, isServed) {
  const pages = files.filter(file => isPage(file) && routePaths(appRoot, dirname(file)).some(isServed));
  const dirs = pages.map(page => `${dirname(page)}${sep}`);
  return files.filter(file =>
    isPage(file) ? pages.includes(file) : dirs.some(dir => dir.startsWith(`${dirname(file)}${sep}`)),
  );
}

/** The app's route filter, bundled from its source (its own aliases resolved) and loaded in this process. */
async function loadRouteFilter(build, root, tsconfigRaw, routes) {
  // Beside the app's own packages, so the bundle's external imports resolve as the app's do.
  const outfile = join(root, 'node_modules', '.cache', 'style-sources', `routes-${process.pid}.cjs`);
  await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, routes.module)],
    bundle: true,
    outfile,
    format: 'cjs',
    platform: 'node',
    packages: 'external',
    jsx: 'automatic',
    logLevel: 'silent',
    tsconfigRaw,
    plugins: [codeOnly],
  });
  try {
    const filter = require(outfile)[routes.export];
    if (typeof filter !== 'function') throw new Error(`${routes.module} exports no function ${routes.export}`);
    return path => filter(...(routes.args ?? []), path);
  } finally {
    rmSync(outfile, { force: true });
  }
}

/** The project's tsconfig `paths`, minus any that point this package somewhere other than node_modules. */
function projectPaths(root) {
  let ts;
  try {
    ts = require(require.resolve('typescript', { paths: [root] }));
  } catch {
    return { baseUrl: root, paths: {} };
  }
  const file = ts.findConfigFile(root, ts.sys.fileExists);
  const parsed = file
    ? ts.getParsedCommandLineOfConfigFile(file, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })
    : null;
  const paths = Object.fromEntries(
    Object.entries(parsed?.options.paths ?? {}).filter(([key]) => key !== PACKAGE && !key.startsWith(`${PACKAGE}/`)),
  );
  return { baseUrl: parsed?.options.baseUrl ?? parsed?.options.pathsBasePath ?? root, paths };
}

const memo = new Map();

function appStyleSources({ root, appDir = 'app', exclude = [], routes = null, alias = {}, firstPaint = false }) {
  if (!isAbsolute(root)) throw new Error('appStyleSources: root must be an absolute path');
  const options = { root, appDir, exclude, routes, alias, firstPaint };
  const key = JSON.stringify(options);
  if (!memo.has(key)) {
    const output = execFileSync(process.execPath, [__filename], {
      input: key,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    memo.set(key, JSON.parse(output.toString()));
  }
  return memo.get(key);
}

/** The walk itself, run in the child process. */
async function walk({ root, appDir, exclude, routes, alias, firstPaint }) {
  const { build } = require(require.resolve('esbuild', { paths: [root, __dirname] }));
  const appRoot = resolve(root, appDir);
  const packageRoot = realpathSync(PACKAGE_DIR);
  const deferred = firstPaint ? LAZY_STYLED.map(file => join(packageRoot, file)) : [];
  const isDeferred = path => deferred.includes(path);
  const { baseUrl, paths } = projectPaths(root);
  const tsconfigRaw = { compilerOptions: { baseUrl, paths, jsx: 'react-jsx' } };
  const allRouteFiles = routeFiles(appRoot, appRoot, exclude, []);
  const entryPoints = routes
    ? servedRouteFiles(appRoot, allRouteFiles, await loadRouteFilter(build, root, tsconfigRaw, routes))
    : allRouteFiles;
  const isPathAlias = specifier =>
    Object.keys(paths).some(key => specifier === key || (key.endsWith('*') && specifier.startsWith(key.slice(0, -1))));

  const graph = {
    name: 'style-sources',
    setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.kind === 'entry-point') return undefined;
        const specifier = args.path;
        if (Object.prototype.hasOwnProperty.call(alias, specifier)) return { path: resolve(root, alias[specifier]) };
        if (specifier.startsWith('.') || isAbsolute(specifier) || isPathAlias(specifier)) return undefined;
        if (specifier === PACKAGE || specifier.startsWith(`${PACKAGE}/`)) return undefined;
        return { path: specifier, external: true };
      });
      builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args =>
        isDeferred(realpathSync(args.path)) ? { contents: '', loader: 'js' } : undefined,
      );
    },
  };

  const result = await build({
    absWorkingDir: root,
    entryPoints,
    bundle: true,
    splitting: true,
    write: false,
    metafile: true,
    outdir: join(root, '.style-sources'),
    format: 'esm',
    platform: 'node',
    conditions: ['import', 'module', 'default'],
    jsx: 'automatic',
    treeShaking: true,
    logLevel: 'silent',
    tsconfigRaw,
    plugins: [graph, codeOnly],
  });

  // A module is scanned when the tree-shaken bundle keeps any of it, as the app's own bundle does.
  const files = new Set();
  for (const output of Object.values(result.metafile.outputs)) {
    for (const [file, { bytesInOutput }] of Object.entries(output.inputs)) {
      const path = resolve(root, file);
      if (bytesInOutput > 0) files.add(path);
    }
  }
  return [...files].sort();
}

if (require.main === module) {
  let input = '';
  process.stdin.on('data', chunk => (input += chunk));
  process.stdin.on('end', () =>
    walk(JSON.parse(input)).then(
      files => process.stdout.write(JSON.stringify(files)),
      error => {
        console.error(`[style-sources] ${error.message}`);
        process.exit(1);
      },
    ),
  );
}

module.exports = { appStyleSources, routePaths, servedRouteFiles, LAZY_STYLED };
