/**
 * String constants shared by page-header consumers (`<PageHeader>`,
 * `<DevSectionPage>`, `<DocsHubPage>` callers). Lives in `utils/` —
 * NOT `'use client'` — so server modules (e.g. the hub's
 * `lib/docs/hub-docs-presets.tsx` that builds preset JSX with
 * `<Icon className={SECTION_HERO_ICON_CLASS} />`) can import the raw
 * string. Importing the constant from a `'use client'` module turns it
 * into a Next.js client-reference proxy in server contexts, which
 * lucide's internal `mergeClasses` then calls `.trim()` on and crashes.
 */

/** Tailwind class applied uniformly to every section-hero / page-header
 *  icon across the lib (Roadmap Map, Releases Rocket, Knowledge Hub
 *  BookOpen, Data Room Building2, …). Yellow accent color, 40x40. */
export const SECTION_HERO_ICON_CLASS = 'h-10 w-10 text-ods-accent'
