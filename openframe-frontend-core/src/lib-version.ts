/**
 * The version of `@flamingo-stack/openframe-frontend-core` this bundle was
 * built from — stamped at build time, readable at runtime.
 *
 * WHY THIS EXISTS. The wire decoder, the source chips and every date formatter
 * ship in this package, and more than one app renders the same payload with
 * them. When a rendering bug is reported against one of those apps, the first
 * question is which build produced the screenshot — and until now that was
 * unanswerable from the artifact alone. Nothing in the shipped bundle named its
 * own version, and the `version` field in this repo's `package.json` is not the
 * answer either: CI reads the last published version off the registry and runs
 * `npm version` immediately before `npm publish`, so the number committed to
 * git is vestigial and does not match anything consumers install.
 *
 * The stamp is taken in CI, where the shipping `prepack` build runs after that
 * rewrite and `package.json` therefore carries the real version. A build run
 * anywhere else (a local `npm run build`, a `yalc publish`) is stamped
 * `<version>-local`, so it can never be mistaken for a published bundle.
 * An unbuilt source tree — a vitest run importing this module directly —
 * reports `'dev'`, because no `define` replaced the global.
 *
 * Surface it wherever a bug report is produced — a footer, a console line, a
 * diagnostics panel — so a screenshot can be traced back to code.
 */

declare const __LIB_VERSION__: string | undefined;

export const LIB_VERSION: string = typeof __LIB_VERSION__ === 'string' ? __LIB_VERSION__ : 'dev';
