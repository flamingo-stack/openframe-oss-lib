/**
 * How a Next.js app that uses this library ships its stylesheet: inside the page, and measured.
 *
 *   const { withInlineStyles } = require('<package>/next-styles')
 *   export default withInlineStyles(nextConfig)                       // next.config
 *
 *   node node_modules/<package>/dist/build/next-styles.cjs budget \
 *     --input src/app/globals.css --config tailwind.config.ts --budget 31500   // the build gate
 *
 * WHY. A page cannot paint before its stylesheet arrives, and a stylesheet in a file of its own is
 * requested only once the HTML names it: one more round trip after the HTML, whatever the file weighs.
 * Measured on flamingo.run (CU-17tkuw617h7, Lighthouse mobile, slow 4G): the 44 KB sheet took 856 ms
 * from request to last byte, a 1 KB sheet beside it 570 ms, and the page painted 65 ms after the large
 * one landed. Cutting the sheet by a quarter moved LCP by nothing measurable; sending the sheet inside
 * the HTML moved the home page's LCP from 1.50 s to 0.93 s and a blog post's from 1.60 s to 0.95 s.
 *
 * WHAT. `withInlineStyles` turns on Next's `experimental.inlineCss`: every stylesheet a route links is
 * written into its HTML as a `<style>` tag instead (production builds, `output: 'export'` included;
 * `next dev` keeps its links). The price is paid in the HTML: the sheet arrives with every page and is
 * not cached apart from it, and Next sends it twice on a first load (the tag and the page's data).
 * That is a good trade only while the sheet is small, so it comes with its gate: `measureStylesheet`
 * builds the app's stylesheet the way its build does (Tailwind, minified) and reports its size
 * brotli-compressed, as a CDN serves it, and the `budget` command fails past a stated size. Keep the
 * sheet small with `appStyleSources` (`./style-sources`): Tailwind content from what the routes import.
 *
 * Per page: a sheet cut per route from the import graph was measured too, and saved 10% (26.4 KB
 * against 29.3 KB brotli on flamingo): a site's shared layout reaches most of the design system, so a
 * page's sheet is mostly its layout's. Inlining removes the wait; a smaller sheet only makes it cheap.
 */
const { execFile } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, isAbsolute, join, resolve } = require('node:path');
const { promisify } = require('node:util');
const { brotliCompressSync, constants } = require('node:zlib');

/** `nextConfig` with every route's stylesheets written into its HTML. Composes with a config function. */
function withInlineStyles(nextConfig) {
  const apply = config => ({ ...config, experimental: { ...config.experimental, inlineCss: true } });
  if (typeof nextConfig === 'function') {
    return async (...args) => apply(await nextConfig(...args));
  }
  return apply(nextConfig);
}

/**
 * The stylesheet `input` with each `@import` made an absolute path: the Tailwind CLI resolves an import
 * by path only, never through a package's `exports` (`@import '<package>/styles'`), which a bundler does.
 */
function resolveImports(input, root) {
  const from = dirname(input);
  return readFileSync(input, 'utf8').replace(/@import\s+(['"])([^'"]+)\1\s*;/g, (statement, _quote, specifier) => {
    if (/^(https?:)?\/\//.test(specifier)) return statement;
    const file =
      specifier.startsWith('.') || isAbsolute(specifier)
        ? resolve(from, specifier)
        : require.resolve(specifier, { paths: [root, from] });
    return `@import "${file}";`;
  });
}

/**
 * Builds `input` with Tailwind and `config` the way the app's build does, minified, and measures it.
 *
 *   root    the app's directory (absolute); `input` and `config` are relative to it.
 *   input   the stylesheet the root layout imports ('src/app/globals.css').
 *   config  the Tailwind config that builds it ('tailwind.config.ts').
 *   env     variables the config reads (an app that builds one site per `NEXT_PUBLIC_APP_TYPE`).
 *
 * Resolves to `{ css, raw, brotli }`: the minified stylesheet, its bytes, and its bytes brotli-compressed
 * at the quality a CDN serves static files with.
 */
async function measureStylesheet({ root, input, config, env = {} }) {
  if (!isAbsolute(root)) throw new Error('measureStylesheet: root must be an absolute path');
  const file = resolve(root, input);
  const dir = mkdtempSync(join(tmpdir(), 'next-styles-'));
  try {
    // The copy lives in the temp folder, never beside the input (a file watcher or linter there would see
    // it). A stylesheet's own `@config` is relative to ITS folder and Tailwind refuses an absolute one, so
    // it is dropped: `config` is what the sheet is built with, as the app's build states it.
    const source = join(dir, 'input.css');
    const output = join(dir, 'output.css');
    writeFileSync(source, resolveImports(file, root).replace(/^\s*@config\s+(['"])[^'"]+\1\s*;\s*$/gm, ''));
    // The app's own Tailwind, the one its build runs; this package's where the app has none of its own.
    const cli = require.resolve('tailwindcss/lib/cli.js', { paths: [root, __dirname] });
    await promisify(execFile)(
      process.execPath,
      [cli, '-c', resolve(root, config), '-i', source, '-o', output, '--minify'],
      {
        cwd: root,
        env: { ...process.env, ...env },
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const css = readFileSync(output, 'utf8');
    const brotli = brotliCompressSync(Buffer.from(css), {
      params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
    }).length;
    return { css, raw: Buffer.byteLength(css), brotli };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;

/** `--name value` pairs of the command line; `--env KEY=VALUE` may repeat. */
function parseArgs(argv) {
  const args = { env: {} };
  for (let i = 0; i < argv.length; i += 2) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (!name.startsWith('--') || value === undefined) throw new Error(`next-styles: bad argument ${name}`);
    if (name === '--env') {
      const at = value.indexOf('=');
      args.env[value.slice(0, at)] = value.slice(at + 1);
    } else {
      args[name.slice(2)] = value;
    }
  }
  return args;
}

/** `budget --input <css> --config <tailwind config> --budget <brotli bytes> [--name <label>] [--env K=V]` */
async function budgetCommand(argv) {
  const args = parseArgs(argv);
  const budget = Number(args.budget);
  if (!args.input || !args.config || !Number.isInteger(budget) || budget <= 0) {
    throw new Error('usage: next-styles budget --input <css> --config <tailwind config> --budget <brotli bytes>');
  }
  const name = args.name ?? args.input;
  const { raw, brotli } = await measureStylesheet({
    root: process.cwd(),
    input: args.input,
    config: args.config,
    env: args.env,
  });
  console.log(`[css-budget] ${name}: ${kb(raw)} raw, ${kb(brotli)} brotli (budget ${kb(budget)})`);
  if (brotli > budget) {
    console.error(
      `[css-budget] FAIL: ${name} is over its budget. Every page carries this stylesheet in its HTML: find what a ` +
        'route now imports that it does not render, or raise the budget with the reason.',
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  const [command, ...rest] = process.argv.slice(2);
  Promise.resolve()
    .then(() => {
      if (command !== 'budget') throw new Error(`next-styles: unknown command ${command ?? '(none)'}; try "budget"`);
      return budgetCommand(rest);
    })
    .catch(error => {
      console.error(`[css-budget] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { withInlineStyles, measureStylesheet, resolveImports };
