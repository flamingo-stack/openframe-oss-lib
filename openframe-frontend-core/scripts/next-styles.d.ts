/** `nextConfig` (an object, or a config function) with every route's stylesheets written into its HTML. */
export function withInlineStyles<T extends object>(
  nextConfig: (...args: never[]) => T | Promise<T>,
): (...args: never[]) => Promise<T & { experimental: { inlineCss: true } }>;
export function withInlineStyles<T extends object>(nextConfig: T): T & { experimental: { inlineCss: true } };

/** Options of {@link measureStylesheet}; each is described in `next-styles.cjs`. */
export interface MeasureStylesheetOptions {
  root: string;
  input: string;
  config: string;
  env?: Record<string, string>;
}

/** The app's stylesheet built as its build builds it, minified: its bytes raw and brotli-compressed. */
export function measureStylesheet(
  options: MeasureStylesheetOptions,
): Promise<{ css: string; raw: number; brotli: number }>;

/** The stylesheet at `input` with each `@import` resolved to an absolute path (packages through their `exports`). */
export function resolveImports(input: string, root: string): string;
