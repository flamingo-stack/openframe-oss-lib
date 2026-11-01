/**
 * Per-route stylesheets for a Next.js App Router app styled with Tailwind: each page carries only the rules
 * for the classes it renders, and the app's complete sheet follows after paint.
 *
 *   next-styles build [--budget 15360] [--full-config tailwind.full.config.ts] [-- <next build args>]
 *
 * WHY. A page cannot paint before its stylesheet, so the sheet is written into the HTML (`withInlineStyles`),
 * and then every page pays for every rule of the app: on flamingo 287 KB raw (29 KB brotli) in every
 * document, of which the home page uses a fifth. Cutting the sheet by what each route IMPORTS saved 10%
 * (a site's layout reaches most of the design system); only what a page RENDERS gets a page to half.
 * Measured on flamingo (CU-17tkuw61z4z): 11.4 to 12.6 KB brotli for the classes in each page's HTML.
 *
 * HOW. Three parts, one build:
 *   1. `next build` runs with `NEXT_STYLES=routes`: the root sheet the app imports is built with no utilities
 *      (`withRouteStylesTailwind`, so it holds the tokens, preflight and the app's own rules), and the root
 *      layout's `RouteStyles` (`<package>/route-styles`) writes a placeholder where the route's rules go.
 *   2. This step reads every page the build prerendered, takes the classes of its HTML (never its scripts: the
 *      page's data names classes a later state renders, which the complete sheet covers), and builds one sheet
 *      per route with the app's own Tailwind config, PostCSS plugins and stylesheet. It writes them where the
 *      server reads them (`.next-styles/`, traced into the server bundle) and fills each prerendered page's
 *      placeholder. A page rendered later (on its first request, or again after `revalidate`) reads its route's
 *      sheet when it renders.
 *   3. The complete sheet, built the same way from the full config, is a static file the page loads after its
 *      first paint, for what the page renders later (a menu opened, a panel loaded, a page navigated to).
 *
 * ORDER. Tailwind v3 writes its rules in its own order whatever the content, so a route's sheet is the complete
 * sheet with rules left out and the rules it keeps in the same order. The complete sheet is inserted last, so
 * once it lands every rule's last copy is in it and the cascade is the complete sheet's. Before it lands, a
 * page's own classes are all in its own sheet, in that order.
 *
 * A route with no prerendered page (one rendered per request) has no sample: its pages carry the complete
 * sheet as before, and this step names them. Build a page of such a route ahead to give it its own sheet.
 */
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { brotliCompressSync, constants } = require('node:zlib');

const { fullSheetUrl } = require('./next-styles.cjs');
const { STYLES_DIR, BUILD_INFO, MANIFEST, PLACEHOLDER, COMPLETE_PLACEHOLDER } = require('./route-styles-markers.cjs');
/** The mark the package's stylesheet carries before `@tailwind components`: the utilities start there. */
const UTILITIES_MARK = '/*! next-styles:utilities */';
const DEFAULT_BUDGET = 15 * 1024;

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
const brotli = css =>
  brotliCompressSync(Buffer.from(css), { params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY } })
    .length;
const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

/** `text` with the HTML entities a class attribute can carry decoded (`[&_svg]:w-4` is written `[&amp;_svg]`). */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, code) => {
    const name = code.toLowerCase();
    if (name === 'amp') return '&';
    if (name === 'quot') return '"';
    if (name === 'apos') return "'";
    if (name === 'lt') return '<';
    if (name === 'gt') return '>';
    const point = name.startsWith('#x') ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
  });
}

/**
 * The class names a page's HTML renders: every `class` attribute outside `<script>`, `<style>` and comments.
 * The page's data (the RSC payload, in scripts) is left out on purpose: what it names beyond the HTML renders
 * after the page is interactive, when the complete sheet is there.
 */
function renderedClasses(html) {
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const classes = new Set();
  for (const match of markup.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const name of decodeEntities(match[1] ?? match[2] ?? '').split(/\s+/)) if (name) classes.add(name);
  }
  return classes;
}

/** The stylesheet at `file` with its own `@config` dropped and each `@import` an absolute path (`next-styles`). */
function readInput(file, root) {
  const { resolveImports } = require('./next-styles.cjs');
  return resolveImports(file, root).replace(/^\s*@config\s+(['"])[^'"]+\1\s*;\s*$/gm, '');
}

/** The app's PostCSS plugins, its own Tailwind replaced by one built with `tailwindConfig` (an object). */
async function postcssPlugins(root, tailwindConfig) {
  const loadPostcssConfig = require(require.resolve('postcss-load-config', { paths: [root, __dirname] }));
  const tailwindcss = require(require.resolve('tailwindcss', { paths: [root, __dirname] }));
  const postcssImport = require(require.resolve('postcss-import', { paths: [root, require.resolve('tailwindcss')] }));
  const { plugins } = await loadPostcssConfig({ env: 'production' }, root);
  const own = plugins.filter(plugin => (plugin.postcssPlugin ?? plugin().postcssPlugin) !== 'tailwindcss');
  return [postcssImport(), tailwindcss(tailwindConfig), ...own];
}

/** The minifier the Tailwind CLI's `--minify` runs, so a measured sheet is measured as the budget gate measures. */
function minifier(root) {
  const deps = require(require.resolve('tailwindcss/lib/cli/build/deps.js', { paths: [root, __dirname] }));
  return deps.loadCssNano();
}

/**
 * A stylesheet builder for the app: `build(content)` is `input` built with `config` (its theme and plugins) and
 * `content` in place of its own, minified, cut at the utilities mark. `content` is `null` for the config's own.
 */
async function stylesheetBuilder({ root, input, config }) {
  const postcss = require(require.resolve('postcss', { paths: [root, __dirname] }));
  const loadConfig = require(require.resolve('tailwindcss/loadConfig', { paths: [root, __dirname] }));
  const source = readInput(resolve(root, input), root);
  const appConfig = loadConfig(resolve(root, config));
  const minify = minifier(root);
  const from = resolve(root, input);
  return async content => {
    const tailwindConfig =
      content === null ? appConfig : { ...appConfig, content: [{ raw: content, extension: 'html' }], safelist: [] };
    const result = await postcss([...(await postcssPlugins(root, tailwindConfig)), minify]).process(source, { from });
    const at = result.css.indexOf(UTILITIES_MARK);
    if (at < 0) {
      throw new Error(
        `next-styles: ${input} has no "${UTILITIES_MARK}" mark: the design-system stylesheet it imports predates per-route sheets`,
      );
    }
    return result.css.slice(at + UTILITIES_MARK.length);
  };
}

/** Every file under `dir` whose name ends with `suffix`. */
function filesUnder(dir, suffix, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(path, suffix, out);
    else if (entry.name.endsWith(suffix)) out.push(path);
  }
  return out;
}

/**
 * The prerendered pages of the build, each with the route it belongs to: `{ file, route }`. A server build keeps
 * them under `<distDir>/server/app` (and the standalone copy), a static export writes them into `distDir`.
 * The route of a page is the prerender manifest's `srcRoute` (`/blog/[slug]` for `/blog/x`).
 */
function prerenderedPages(root, info) {
  const distDir = resolve(root, info.distDir);
  const manifestFile = join(distDir, 'prerender-manifest.json');
  const routes = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')).routes : {};
  const routeOf = new Map();
  for (const [path, entry] of Object.entries(routes)) routeOf.set(path, entry.srcRoute ?? path);
  const pathOfFile = (base, file) => {
    const rel = relative(base, file)
      .split('\\')
      .join('/')
      .replace(/\.html$/, '');
    const path = `/${rel}`.replace(/\/index$/, '') || '/';
    return path === '' ? '/' : path;
  };
  const bases = info.output === 'export' ? [distDir] : [join(distDir, 'server', 'app')];
  const pages = [];
  for (const base of bases) {
    for (const file of filesUnder(base, '.html')) {
      if (info.output === 'export' && relative(distDir, file).startsWith(`_next`)) continue;
      const path = pathOfFile(base, file);
      const route = routeOf.get(path) ?? routeOf.get(`${path}/`) ?? (path === '/' ? '/' : null);
      // `global-error` renders its own document, never the root layout's sheet.
      if (route && route !== '/_global-error') pages.push({ file, path, route });
    }
  }
  return pages;
}

/** The standalone copies of a server build's files (`<distDir>/standalone/...`), found by the copy of `marker`. */
function standaloneCopies(root, info, marker) {
  const standalone = resolve(root, info.distDir, 'standalone');
  return filesUnder(standalone, marker).map(file => file.slice(0, -marker.length));
}

/** `html` with its placeholders filled: the route's rules `css` and the complete sheet `full`. */
function fillPlaceholder(html, { css, full }) {
  return html.split(PLACEHOLDER).join(css).split(COMPLETE_PLACEHOLDER).join(full);
}

/** A free TCP port on this machine. */
function freePort() {
  const net = require('node:net');
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

/**
 * The page routes of the build that no prerendered page samples and that have no dynamic segment: rendered per
 * request (`/pricing` reads a live price), so the only sample is a request. Route handlers and `/api` are not
 * pages; a route with a dynamic segment has no address to ask without a record.
 */
function unsampledStaticRoutes(root, info, sampled) {
  const file = join(resolve(root, info.distDir), 'app-path-routes-manifest.json');
  if (!fs.existsSync(file)) return [];
  const routes = new Set();
  for (const [entry, route] of Object.entries(JSON.parse(fs.readFileSync(file, 'utf8')))) {
    if (!entry.endsWith('/page')) continue;
    if (route.includes('[') || route === '/api' || route.startsWith('/api/') || route.startsWith('/_')) continue;
    if (!sampled.has(route)) routes.add(route);
  }
  return [...routes].sort();
}

/**
 * The HTML of `routes`, asked of the finished build served on this machine (`next start`): `{ route, html }` for
 * each that answers 200 with a page. A route that answers anything else (not served here, a redirect, a refusal)
 * keeps the complete sheet.
 */
async function crawlRoutes(root, routes, { concurrency = 4, timeoutMs = 60_000 } = {}) {
  if (!routes.length) return [];
  const port = await freePort();
  const nextBin = require.resolve('next/dist/bin/next', { paths: [root] });
  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    const ready = Date.now() + timeoutMs;
    for (;;) {
      if (server.exitCode !== null) throw new Error(`next-styles: next start exited ${server.exitCode}`);
      const answered = await fetch(base, { redirect: 'manual' }).then(
        () => true,
        () => false,
      );
      if (answered) break;
      if (Date.now() > ready) throw new Error('next-styles: next start did not answer');
      await new Promise(done => setTimeout(done, 250));
    }
    const pages = [];
    const queue = [...routes];
    // An app whose pages carry the complete sheet (`RouteStyles complete`, a signed-in hub) reads no route sheet.
    let everyPageComplete = false;
    const worker = async () => {
      for (let route = queue.shift(); route; route = queue.shift()) {
        try {
          const response = await fetch(`${base}${route}`, {
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
            headers: { accept: 'text/html' },
          });
          const html = await response.text();
          if (html.includes(COMPLETE_PLACEHOLDER) && !html.includes(PLACEHOLDER)) {
            everyPageComplete = true;
            queue.length = 0;
          } else if (response.status === 200 && /<html[\s>]/i.test(html)) pages.push({ route, html });
        } catch (error) {
          console.warn(`[next-styles] ${route}: no sample (${error.message})`);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return everyPageComplete ? [] : pages;
  } finally {
    server.kill('SIGTERM');
  }
}

/**
 * The route sheets of a finished build: built, written, filled into the prerendered pages and checked against
 * `budget` (brotli bytes per route). Resolves to the report; sets a failing exit code over the budget.
 */
async function writeRouteStyles({ root, input, config, fullConfig, budget = DEFAULT_BUDGET, crawl = true }) {
  const stylesDir = join(root, STYLES_DIR);
  const info = JSON.parse(fs.readFileSync(join(stylesDir, BUILD_INFO), 'utf8'));
  const pages = prerenderedPages(root, info);

  const classesByRoute = new Map();
  const sample = (route, html) => {
    const classes = classesByRoute.get(route) ?? new Set();
    for (const name of renderedClasses(html)) classes.add(name);
    classesByRoute.set(route, classes);
  };
  for (const page of pages) sample(page.route, fs.readFileSync(page.file, 'utf8'));
  // A static export has no server; every other build is asked for the pages it renders per request.
  const unsampled =
    info.output === 'export' || !crawl ? [] : unsampledStaticRoutes(root, info, new Set(classesByRoute.keys()));
  const crawled = await crawlRoutes(root, unsampled);
  for (const page of crawled) sample(page.route, page.html);

  const routeSheet = await stylesheetBuilder({ root, input, config });
  const fullSheet = fullConfig === config ? routeSheet : await stylesheetBuilder({ root, input, config: fullConfig });
  const full = await fullSheet(null);
  const fullUrl = fullSheetUrl(info);
  const fullFile = fullUrl.split('/').pop();

  const routes = {};
  const sheets = new Map();
  for (const [route, classes] of [...classesByRoute].sort(([a], [b]) => a.localeCompare(b))) {
    const css = await routeSheet([...classes].sort().join(' '));
    const file = `route-${hash(css)}.css`;
    sheets.set(file, css);
    routes[route] = { file, raw: Buffer.byteLength(css), brotli: brotli(css), pages: 0 };
  }
  for (const page of [...pages, ...crawled]) routes[page.route].pages += 1;

  // The server reads these (traced into its bundle by `withRouteStyles`); the complete sheet is also a static file.
  const targets = [
    stylesDir,
    ...standaloneCopies(root, info, join(STYLES_DIR, BUILD_INFO)).map(dir => join(dir, STYLES_DIR)),
  ];
  for (const dir of targets) {
    fs.mkdirSync(join(dir, 'sheets'), { recursive: true });
    for (const [file, css] of sheets) fs.writeFileSync(join(dir, 'sheets', file), css);
    fs.writeFileSync(join(dir, 'sheets', fullFile), full);
  }
  const staticDir =
    info.output === 'export'
      ? join(resolve(root, info.distDir), '_next', 'static')
      : join(resolve(root, info.distDir), 'static');
  fs.mkdirSync(join(staticDir, 'next-styles'), { recursive: true });
  fs.writeFileSync(join(staticDir, 'next-styles', fullFile), full);
  const manifest = { version: 1, buildId: info.buildId, full: fullFile, fullUrl, routes };
  for (const dir of targets) fs.writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  // Fill every prerendered page, the standalone copies included (the server answers those directly).
  const copies = standaloneCopies(root, info, join(STYLES_DIR, BUILD_INFO)).map(dir =>
    join(dir, relative(root, resolve(root, info.distDir)), 'server', 'app'),
  );
  for (const page of pages) {
    const css = sheets.get(routes[page.route].file);
    const files = [
      page.file,
      ...copies.map(dir => join(dir, relative(join(resolve(root, info.distDir), 'server', 'app'), page.file))),
    ];
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf8');
      if (html.includes(PLACEHOLDER) || html.includes(COMPLETE_PLACEHOLDER)) {
        fs.writeFileSync(file, fillPlaceholder(html, { css, full }));
      }
    }
  }

  const missed = unsampled.filter(route => !routes[route]);
  if (missed.length)
    console.log(
      `[next-styles] complete sheet for ${missed.length} route(s) that answered no page: ${missed.join(', ')}`,
    );
  const over = Object.entries(routes).filter(([, sheet]) => sheet.brotli > budget);
  console.log(
    `[next-styles] complete sheet ${kb(Buffer.byteLength(full))} raw, ${kb(brotli(full))} brotli (after paint)`,
  );
  for (const [route, sheet] of Object.entries(routes)) {
    console.log(
      `[next-styles] ${sheet.brotli > budget ? 'OVER' : 'ok  '} ${kb(sheet.brotli).padStart(8)} brotli  ${route} (${sheet.pages} page${sheet.pages === 1 ? '' : 's'})`,
    );
  }
  if (over.length) {
    console.error(
      `[next-styles] FAIL: ${over.length} route sheet(s) over ${kb(budget)} brotli. A route's sheet is what its page renders ` +
        'before it is interactive: render less on the first screen (load the rest when it opens), or raise the budget with the reason.',
    );
    process.exitCode = 1;
  }
  return manifest;
}

/** Runs `command args` in `root` with `env` added, resolving on exit 0. */
function run(command, args, { root, env }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', code =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)),
    );
  });
}

/**
 * `next build` with per-route sheets: prepares `.next-styles/`, runs the build with `NEXT_STYLES=routes`, then
 * writes the route sheets. `nextArgs` are passed to `next build`.
 */
async function buildWithRouteStyles({ root, nextArgs = [], ...options }) {
  const stylesDir = join(root, STYLES_DIR);
  fs.rmSync(stylesDir, { recursive: true, force: true });
  fs.mkdirSync(join(stylesDir, 'sheets'), { recursive: true });
  // The server bundle traces these files when it is built, so they exist before it is (filled after it).
  fs.writeFileSync(join(stylesDir, MANIFEST), `${JSON.stringify({ version: 1, pending: true })}\n`);
  const nextBin = require.resolve('next/dist/bin/next', { paths: [root] });
  await run(process.execPath, [nextBin, 'build', ...nextArgs], { root, env: { NEXT_STYLES: 'routes' } });
  if (!fs.existsSync(join(stylesDir, BUILD_INFO))) {
    throw new Error('next-styles: the build did not record its settings: wrap next.config with withRouteStyles');
  }
  return writeRouteStyles({ root, ...options });
}

module.exports = {
  STYLES_DIR,
  MANIFEST,
  BUILD_INFO,
  UTILITIES_MARK,
  PLACEHOLDER,
  COMPLETE_PLACEHOLDER,
  DEFAULT_BUDGET,
  renderedClasses,
  stylesheetBuilder,
  prerenderedPages,
  crawlRoutes,
  writeRouteStyles,
  buildWithRouteStyles,
};
