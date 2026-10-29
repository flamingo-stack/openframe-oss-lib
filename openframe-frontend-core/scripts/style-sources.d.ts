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
