import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const routeStyles = require('../../scripts/route-styles.cjs') as {
  UTILITIES_MARK: string;
  PLACEHOLDER: string;
  renderedClasses: (html: string) => Set<string>;
  stylesheetBuilder: (options: {
    root: string;
    input: string;
    config: string;
  }) => Promise<(content: string | null) => Promise<string>>;
  writeRouteStyles: (options: {
    root: string;
    input: string;
    config: string;
    fullConfig: string;
    budget?: number;
  }) => Promise<{ fullUrl: string; routes: Record<string, { file: string; pages: number }> }>;
};
const { withRouteStyles, fullSheetUrl } = require('../../scripts/next-styles.cjs') as {
  withRouteStyles: (config: object) => (phase: string) => Promise<Record<string, unknown>>;
  fullSheetUrl: (info: { buildId: string; assetPrefix?: string; basePath?: string }) => string;
};
const { withRouteStylesTailwind } = require('../../scripts/style-sources.cjs') as {
  withRouteStylesTailwind: <T extends object>(config: T) => T;
};

describe('route-styles: the classes a page renders', () => {
  it('reads class attributes, decodes entities, and skips scripts, styles and comments', () => {
    const html = [
      '<html class="dark"><head><style>.x{color:red}</style></head>',
      '<body class="bg-ods-bg  p-4"><!-- <div class="commented"> -->',
      `<div class='[&amp;_svg]:w-4 md:p-6'></div>`,
      '<script>self.__next_f.push([1,"{\\"className\\":\\"only-in-data\\"}"])</script></body></html>',
    ].join('');
    expect([...routeStyles.renderedClasses(html)].sort()).toEqual([
      '[&_svg]:w-4',
      'bg-ods-bg',
      'dark',
      'md:p-6',
      'p-4',
    ]);
  });
});

describe('route-styles: a route sheet is the complete sheet with rules left out', () => {
  let root: string;
  let build: (content: string | null) => Promise<string>;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'route-styles-test-'));
    mkdirSync(join(root, 'app'), { recursive: true });
    writeFileSync(
      join(root, 'app', 'page.tsx'),
      'export default () => <p className="p-2 md:p-4 text-center flex hidden md:block lg:flex-row" />',
    );
    writeFileSync(
      join(root, 'app', 'globals.css'),
      `:root{--gap:4px}\n@tailwind base;\n${routeStyles.UTILITIES_MARK}\n@tailwind components;\n@tailwind utilities;\n.app-rule{color:red}\n`,
    );
    writeFileSync(
      join(root, 'tailwind.config.cjs'),
      `module.exports = { content: [${JSON.stringify(join(root, 'app', 'page.tsx'))}] }`,
    );
    writeFileSync(
      join(root, 'postcss.config.cjs'),
      `module.exports = { plugins: { ${JSON.stringify(require.resolve('tailwindcss'))}: {} } }`,
    );
    build = await routeStyles.stylesheetBuilder({ root, input: 'app/globals.css', config: 'tailwind.config.cjs' });
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('keeps only the utilities and the rules after them, never the base', async () => {
    const full = await build(null);
    expect(full).not.toContain('--gap');
    expect(full).not.toContain('box-sizing');
    expect(full).toContain('.app-rule');
  });

  it('writes the rules it keeps in the complete sheet’s order, whatever order the classes come in', async () => {
    const full = await build(null);
    const route = await build('md:p-4 p-2 md:block');
    const order = (css: string, selectors: string[]) => selectors.map(selector => css.indexOf(selector));
    const selectors = ['.p-2{', '.md\\:block{', '.md\\:p-4{'];
    const inRoute = order(route, selectors);
    expect(inRoute.every(at => at >= 0)).toBe(true);
    expect(inRoute).toEqual([...inRoute].sort((a, b) => a - b));
    expect(order(full, selectors)).toEqual([...order(full, selectors)].sort((a, b) => a - b));
    expect(route).not.toContain('.text-center');
    expect(route).toContain('.app-rule');
  });
});

describe('route-styles: a finished build', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'route-styles-build-'));
    mkdirSync(join(root, 'app'), { recursive: true });
    mkdirSync(join(root, '.next', 'server', 'app', 'blog'), { recursive: true });
    mkdirSync(join(root, '.next', 'static'), { recursive: true });
    mkdirSync(join(root, '.next-styles'), { recursive: true });
    writeFileSync(join(root, 'app', 'page.tsx'), 'export default () => <p className="p-2 text-center underline" />');
    writeFileSync(
      join(root, 'app', 'globals.css'),
      `@tailwind base;\n${routeStyles.UTILITIES_MARK}\n@tailwind components;\n@tailwind utilities;\n`,
    );
    writeFileSync(
      join(root, 'tailwind.config.cjs'),
      `module.exports = { content: [${JSON.stringify(join(root, 'app', 'page.tsx'))}] }`,
    );
    writeFileSync(
      join(root, 'postcss.config.cjs'),
      `module.exports = { plugins: { ${JSON.stringify(require.resolve('tailwindcss'))}: {} } }`,
    );
    writeFileSync(
      join(root, '.next-styles', 'build.json'),
      JSON.stringify({ buildId: 'b1', distDir: '.next', output: null }),
    );
    writeFileSync(
      join(root, '.next', 'prerender-manifest.json'),
      JSON.stringify({
        routes: {
          '/': { srcRoute: '/' },
          '/blog/a': { srcRoute: '/blog/[slug]' },
          '/blog/b': { srcRoute: '/blog/[slug]' },
        },
      }),
    );
    const page = (classes: string) =>
      `<html><head><style data-href="next-styles:x" data-precedence="next-styles">${routeStyles.PLACEHOLDER}</style></head><body class="${classes}"><script data-next-styles-full="/_next/static/next-styles/full-b1.css"></script></body></html>`;
    writeFileSync(join(root, '.next', 'server', 'app', 'index.html'), page('p-2'));
    writeFileSync(join(root, '.next', 'server', 'app', 'blog', 'a.html'), page('text-center'));
    writeFileSync(join(root, '.next', 'server', 'app', 'blog', 'b.html'), page('underline'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('builds one sheet per route from all of its pages, and fills every page', async () => {
    const manifest = await routeStyles.writeRouteStyles({
      root,
      input: 'app/globals.css',
      config: 'tailwind.config.cjs',
      fullConfig: 'tailwind.config.cjs',
    });
    expect(Object.keys(manifest.routes).sort()).toEqual(['/', '/blog/[slug]']);
    expect(manifest.routes['/blog/[slug]'].pages).toBe(2);
    const blogSheet = readFileSync(join(root, '.next-styles', 'sheets', manifest.routes['/blog/[slug]'].file), 'utf8');
    expect(blogSheet).toContain('.text-center');
    expect(blogSheet).toContain('.underline');
    expect(blogSheet).not.toContain('.p-2');
    const home = readFileSync(join(root, '.next', 'server', 'app', 'index.html'), 'utf8');
    expect(home).not.toContain(routeStyles.PLACEHOLDER);
    expect(home).toContain('.p-2');
    expect(home).toContain(`data-next-styles-full="${manifest.fullUrl}"`);
    expect(
      readFileSync(join(root, '.next', 'static', 'next-styles', manifest.fullUrl.split('/').pop() as string), 'utf8'),
    ).toContain('.underline');
  });
});

describe('next-styles: the route-styles config wrappers', () => {
  it('leave the configs alone outside next-styles build', async () => {
    const tailwind = { content: ['a'], safelist: ['b'] };
    expect(withRouteStylesTailwind(tailwind)).toBe(tailwind);
    const next = await withRouteStyles({ distDir: 'dist' })('phase-production-build');
    expect(next).toEqual({ distDir: 'dist', experimental: { inlineCss: true } });
  });

  it('name the complete sheet by the build, so the browser bundle knows its address', () => {
    expect(fullSheetUrl({ buildId: 'b1' })).toBe('/_next/static/next-styles/full-b1.css');
    expect(fullSheetUrl({ buildId: 'b1', basePath: '/help/' })).toBe('/help/_next/static/next-styles/full-b1.css');
  });

  it('under next-styles build, build the root sheet with no utilities', () => {
    process.env.NEXT_STYLES = 'routes';
    try {
      expect(withRouteStylesTailwind({ content: ['a'], safelist: ['b'], theme: {} })).toEqual({
        content: [{ raw: '', extension: 'html' }],
        safelist: [],
        theme: {},
      });
    } finally {
      delete process.env.NEXT_STYLES;
    }
  });
});

describe('RouteStyles: the rules a page gets on the server', () => {
  let root: string;
  let cwd: string;

  beforeAll(() => {
    cwd = process.cwd();
    root = mkdtempSync(join(tmpdir(), 'route-styles-runtime-'));
    mkdirSync(join(root, '.next-styles', 'sheets'), { recursive: true });
    const routes = { '/': 'home', '/blog': 'blog', '/blog/[slug]': 'post', '/docs/[...path]': 'docs' };
    writeFileSync(
      join(root, '.next-styles', 'manifest.json'),
      JSON.stringify({
        version: 1,
        buildId: 'b2',
        full: 'full.css',
        fullUrl: '/_next/static/next-styles/full.css',
        routes: Object.fromEntries(Object.entries(routes).map(([route, file]) => [route, { file: `${file}.css` }])),
      }),
    );
    for (const name of [...Object.values(routes), 'full'])
      writeFileSync(join(root, '.next-styles', 'sheets', `${name}.css`), `.${name}{}`);
    process.chdir(root);
    process.env.NEXT_STYLES_BUILD = 'b2';
  });

  afterAll(() => {
    process.chdir(cwd);
    delete process.env.NEXT_STYLES_BUILD;
    rmSync(root, { recursive: true, force: true });
  });

  it('matches the page path to its route, a static route before a dynamic one, and the complete sheet otherwise', async () => {
    const { RouteStyles } = await import('../../scripts/route-styles-server.mjs');
    const element = RouteStyles({}) as { props: { build: string } };
    expect(element.props.build).toBe('b2');
    const resolve = (
      globalThis as Record<
        symbol,
        Map<string, (path: string, complete: boolean) => { css: string; fullUrl: string | null }>
      >
    )[Symbol.for('flamingo.next-styles')].get('b2');
    if (!resolve) throw new Error('RouteStyles registered no resolver');
    expect(resolve('/', false).css).toBe('.home{}');
    expect(resolve('/blog/', false).css).toBe('.blog{}');
    expect(resolve('/blog/a-post', false)).toEqual({ css: '.post{}', fullUrl: '/_next/static/next-styles/full.css' });
    expect(resolve('/docs/a/b', false).css).toBe('.docs{}');
    expect(resolve('/unknown', false)).toEqual({ css: '.full{}', fullUrl: null });
    expect(resolve('/blog', true)).toEqual({ css: '.full{}', fullUrl: null });
  });
});
