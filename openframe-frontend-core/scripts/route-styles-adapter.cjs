/**
 * The route step of `next-styles build` as a Next.js build adapter (`adapterPath`), set by `withRouteStyles`.
 *
 * WHY. A step that runs after `next build` changes files nobody serves any more on a host whose own build adapter
 * packages the output when `next build` ends: on Vercel ("Applying modifyConfig from Vercel" in the build log) the
 * pages, functions and static files are collected by the adapter's `onBuildComplete`, so the placeholders filled
 * afterwards reached production unfilled and a page rendered per request found no `.next-styles/` (2026-11-01,
 * hub #1753, rolled back). An adapter's `onBuildComplete` is the one hook Next runs after every page is prerendered
 * and before anything is packaged (before the standalone copy too), so the step runs there.
 *
 * HOW. Next loads one adapter, so this one WRAPS the adapter the build would have had (`build.json`'s `inner`: the
 * app's own `adapterPath`, else `NEXT_ADAPTER_PATH`, which the host sets): its `modifyConfig` is the inner one's,
 * and its `onBuildComplete` writes the route sheets, fills the prerendered pages, adds what it wrote to the outputs
 * the inner adapter packages (`.next-styles/` to every server function, the complete sheet to the static files),
 * and then hands the outputs on. With no inner adapter (a build on this machine, a Docker image) the build goes on
 * as Next's own.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const { STYLES_DIR, BUILD_INFO } = require('./route-styles-markers.cjs');

const readInfo = root => JSON.parse(fs.readFileSync(join(root, STYLES_DIR, BUILD_INFO), 'utf8'));

/** The adapter this one wraps (`null` for none), loaded once. */
let innerAdapter;
async function inner(root) {
  if (innerAdapter !== undefined) return innerAdapter;
  const path = readInfo(root).inner;
  if (!path) return (innerAdapter = null);
  const mod = await import(pathToFileURL(require.resolve(path, { paths: [root] })).href);
  return (innerAdapter = mod.default ?? mod);
}

/** Every file under `dir`. */
function filesUnder(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(path, out);
    else out.push(path);
  }
  return out;
}

/** A file's content hash as Next's adapter computes it (`hashFile` in next/dist/build/adapter/build-complete). */
function hashFile(salt, file) {
  return crypto.createHash('sha256').update(salt).update('file:').update(fs.readFileSync(file)).digest('hex');
}

/**
 * `outputs` with what the route step wrote: `.next-styles/` in every Node.js server function (read at run time by
 * `RouteStyles`, so no trace finds the sheets written after the trace), and the complete sheet among the static
 * files (collected before this step wrote it).
 */
function addRouteStyles(ctx) {
  const root = ctx.projectDir;
  const info = readInfo(root);
  const salt = ctx.config.outputHashSalt || '';
  const files = filesUnder(join(root, STYLES_DIR)).map(file => ({
    key: relative(ctx.repoRoot, file).split('\\').join('/'),
    file,
    hash: hashFile(salt, file),
  }));
  const functions = [
    ...ctx.outputs.appPages,
    ...ctx.outputs.appRoutes,
    ...ctx.outputs.pages,
    ...ctx.outputs.pagesApi,
  ].filter(output => output.runtime === 'nodejs');
  for (const output of functions) {
    for (const { key, file, hash } of files) {
      output.assets[key] = file;
      // Next records a hash only for a Turbopack build; where it records any, it records one for every asset.
      if (output.assetsHashes && Object.keys(output.assetsHashes).length) output.assetsHashes[key] = hash;
    }
  }
  const staticDir = join(resolve(root, info.distDir), 'static');
  const sheets = join(staticDir, 'next-styles');
  for (const file of fs.existsSync(sheets) ? filesUnder(sheets) : []) {
    const id = relative(resolve(root, info.distDir), file).split('\\').join('/');
    if (ctx.outputs.staticFiles.some(output => output.id === id)) continue;
    ctx.outputs.staticFiles.push({
      type: 'STATIC_FILE', // AdapterOutputType.STATIC_FILE (next/dist/shared/lib/constants)
      id,
      // Next adds the basePath to every pathname before it calls the adapter.
      pathname: `${ctx.config.basePath || ''}/_next/${id}`,
      filePath: file,
      immutableHash: undefined,
    });
  }
}

module.exports = {
  name: 'next-styles',

  async modifyConfig(config, ctx) {
    const adapter = await inner(ctx.projectDir);
    return typeof adapter?.modifyConfig === 'function' ? adapter.modifyConfig(config, ctx) : config;
  },

  async onBuildComplete(ctx) {
    const root = ctx.projectDir;
    const { options } = readInfo(root);
    // The build tool, loaded only here (`./next-styles.cjs` explains why the config must not reach it).
    const { writeRouteStyles } = require(join(__dirname, 'route-styles.cjs'));
    const report = await writeRouteStyles({ root, ...options });
    if (report.over.length) {
      throw new Error(
        `next-styles: ${report.over.length} route sheet(s) over the budget: ${report.over.join(', ')} (listed above)`,
      );
    }
    addRouteStyles(ctx);
    const adapter = await inner(root);
    if (typeof adapter?.onBuildComplete === 'function') await adapter.onBuildComplete(ctx);
  },
};
