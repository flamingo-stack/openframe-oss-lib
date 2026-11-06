/** `nextConfig` (an object, or a config function) with every route's stylesheets written into its HTML. */
export function withInlineStyles<A extends unknown[], T extends object>(
  nextConfig: (...args: A) => T | Promise<T>,
): (...args: A) => Promise<T & { experimental: { inlineCss: true } }>;
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

/**
 * `withInlineStyles`, plus per-route stylesheets when the build runs as `next-styles build`: the server bundle
 * carries `.next-styles/` and knows its build. Any other build and `next dev` get `withInlineStyles` alone.
 */
export function withRouteStyles<T extends object>(
  nextConfig: T | ((...args: unknown[]) => T | Promise<T>),
): (phase: string, ...rest: unknown[]) => Promise<T & { experimental: { inlineCss: true } }>;
