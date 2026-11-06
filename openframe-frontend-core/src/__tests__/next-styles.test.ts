import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  measureStylesheet as Measure,
  resolveImports as Resolve,
  withInlineStyles as WithInline,
} from '../../scripts/next-styles';

const { withInlineStyles, measureStylesheet, resolveImports } = createRequire(import.meta.url)(
  '../../scripts/next-styles.cjs',
) as { withInlineStyles: typeof WithInline; measureStylesheet: typeof Measure; resolveImports: typeof Resolve };

describe('next-styles: withInlineStyles', () => {
  it('turns inlining on and keeps the rest of the config and its experimental flags', () => {
    const config = withInlineStyles({ output: 'export', experimental: { scrollRestoration: false } });
    expect(config).toEqual({ output: 'export', experimental: { scrollRestoration: false, inlineCss: true } });
  });

  it('wraps a config function, phase and context passed through', async () => {
    const wrapped = withInlineStyles((phase: string) => ({ distDir: phase }));
    await expect(wrapped('phase-production-build')).resolves.toEqual({
      distDir: 'phase-production-build',
      experimental: { inlineCss: true },
    });
  });
});

describe('next-styles: the stylesheet as the build builds it', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'next-styles-test-'));
    mkdirSync(join(root, 'src', 'app'), { recursive: true });
    writeFileSync(join(root, 'src', 'app', 'page.tsx'), 'export default () => <p className="p-4 text-center" />');
    writeFileSync(join(root, 'src', 'app', 'tokens.css'), ':root{--gap:4px}');
    writeFileSync(join(root, 'src', 'app', 'globals.css'), "@import './tokens.css';\n@tailwind utilities;\n");
    writeFileSync(
      join(root, 'tailwind.config.cjs'),
      `module.exports = { content: [${JSON.stringify(join(root, 'src', 'app', 'page.tsx'))}] }`,
    );
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('makes a relative import absolute and leaves a remote one alone', () => {
    writeFileSync(
      join(root, 'src', 'app', 'remote.css'),
      '@import \'https://fonts.example/x.css\';\n@import "./tokens.css";',
    );
    expect(resolveImports(join(root, 'src', 'app', 'remote.css'), root)).toBe(
      `@import 'https://fonts.example/x.css';\n@import "${join(root, 'src', 'app', 'tokens.css')}";`,
    );
  });

  it('builds a stylesheet that names its own config relative to its folder, and leaves no copy behind', async () => {
    writeFileSync(
      join(root, 'src', 'app', 'full.css'),
      "@config '../../tailwind.config.cjs';\n@import './tokens.css';\n@tailwind utilities;\n",
    );
    const { css } = await measureStylesheet({ root, input: 'src/app/full.css', config: 'tailwind.config.cjs' });
    expect(css).toContain('.p-4{');
    expect(readdirSync(join(root, 'src', 'app')).filter(name => name.endsWith('.measure.css'))).toEqual([]);
  });

  it('holds the imported rules and only the classes the content uses, and measures them', async () => {
    const { css, raw, brotli } = await measureStylesheet({
      root,
      input: 'src/app/globals.css',
      config: 'tailwind.config.cjs',
    });
    expect(css).toContain('--gap:4px');
    expect(css).toContain('.p-4{');
    expect(css).toContain('.text-center{');
    expect(css).not.toContain('.p-8{');
    expect(raw).toBe(Buffer.byteLength(css));
    expect(brotli).toBeGreaterThan(0);
  });

  it('budget finds the stylesheet and the config itself, and fails past the budget', () => {
    const script = join(__dirname, '..', '..', 'scripts', 'next-styles.cjs');
    const run = (budget: number) =>
      execFileSync(process.execPath, [script, 'budget', '--budget', String(budget)], { cwd: root, encoding: 'utf8' });
    expect(run(100_000)).toContain('[css-budget] src/app/globals.css:');
    expect(() => run(1)).toThrow();
  });
});
