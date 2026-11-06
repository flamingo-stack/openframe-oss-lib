import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { appStyleSources, routePaths, servedRouteFiles } = createRequire(import.meta.url)(
  '../../scripts/style-sources.cjs',
) as {
  appStyleSources: (options: {
    root: string;
    appDir?: string;
    exclude?: string[];
    routes?: { module: string; export: string; args?: unknown[] } | null;
  }) => string[];
  routePaths: (appRoot: string, dir: string) => string[];
  servedRouteFiles: (appRoot: string, files: string[], isServed: (path: string) => boolean) => string[];
};

describe('style-sources: which routes a build serves', () => {
  const app = '/repo/app';

  it('asks about a static route by its path', () => {
    expect(routePaths(app, '/repo/app/(site)/pricing')).toEqual(['/pricing']);
  });

  it('asks about a dynamic route by a sample path and by the static part above it', () => {
    expect(routePaths(app, '/repo/app/blog/[slug]')).toEqual(['/blog/x', '/blog']);
    // A landing page served at exact paths ('/ai-copilots') is known to no filter as '/x'.
    expect(routePaths(app, '/repo/app/(landing)/[landingSlug]')).toEqual(['/x', '/']);
  });

  it('keeps a served page and the layouts above it, and nothing under a refused one', () => {
    const files = [
      '/repo/app/layout.tsx',
      '/repo/app/page.tsx',
      '/repo/app/blog/layout.tsx',
      '/repo/app/blog/[slug]/page.tsx',
      '/repo/app/prompts/layout.tsx',
      '/repo/app/prompts/page.tsx',
    ];
    const served = servedRouteFiles(app, files, path => path === '/' || path.startsWith('/blog'));
    expect(served).toEqual([
      '/repo/app/layout.tsx',
      '/repo/app/page.tsx',
      '/repo/app/blog/layout.tsx',
      '/repo/app/blog/[slug]/page.tsx',
    ]);
  });
});

describe('style-sources: the files an app imports', () => {
  let root: string;
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'style-sources-'));
    write('app/layout.tsx', "import { Shell } from '../components/shell';\nexport default Shell;\n");
    write('app/page.tsx', 'export default () => <main className="p-2" />;\n');
    write('app/blog/[slug]/page.tsx', "export default () => import('../../../components/lazy');\n");
    write('app/admin/page.tsx', "import { Table } from '../../components/table';\nexport default Table;\n");
    write('app/prompts/page.tsx', "import { Prompt } from '../../components/prompt';\nexport default Prompt;\n");
    write('components/shell.tsx', 'export const Shell = ({ children }) => <div className="flex">{children}</div>;\n');
    write('components/lazy.tsx', 'export default () => <div className="grid" />;\n');
    write('components/table.tsx', 'export const Table = () => <table className="w-full" />;\n');
    write('components/prompt.tsx', 'export const Prompt = () => <p className="italic" />;\n');
    write('components/unused.tsx', 'export const Unused = () => <p className="hidden" />;\n');
    write('routes.ts', "export const served = (path: string) => path !== '/prompts';\n");
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const relative = (files: string[]) => files.map(file => file.slice(root.length + 1)).sort();

  it('lists what the served routes import, lazy imports included, and nothing else', () => {
    const files = appStyleSources({ root, routes: { module: 'routes.ts', export: 'served' } });
    expect(relative(files)).toEqual([
      'app/admin/page.tsx',
      'app/blog/[slug]/page.tsx',
      'app/layout.tsx',
      'app/page.tsx',
      'components/lazy.tsx',
      'components/shell.tsx',
      'components/table.tsx',
    ]);
  });

  it('leaves an excluded route directory out', () => {
    const files = appStyleSources({ root, exclude: ['admin'], routes: { module: 'routes.ts', export: 'served' } });
    expect(relative(files)).not.toContain('components/table.tsx');
    expect(relative(files)).not.toContain('app/admin/page.tsx');
  });
});
