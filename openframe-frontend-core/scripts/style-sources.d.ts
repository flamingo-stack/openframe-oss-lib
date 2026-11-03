/** Options of {@link appStyleSources}; each is described in `style-sources.cjs`. */
export interface AppStyleSourcesOptions {
  root: string;
  appDir?: string;
  exclude?: string[];
  routes?: { module: string; export: string; args?: unknown[] } | null;
  alias?: Record<string, string>;
  firstPaint?: boolean;
}

/** The files a Next.js app's served routes import, for Tailwind's `content`. */
export function appStyleSources(options: AppStyleSourcesOptions): string[];

/** The root sheet's Tailwind config: no utilities under `next-styles build` (each route brings its own). */
export function withRouteStylesTailwind<T extends object>(config: T): T;

/** Where a config wrapped by {@link withRouteStylesTailwind} keeps the app's own (the complete sheet's). */
export const APP_TAILWIND_CONFIG: unique symbol;
