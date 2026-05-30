/**
 * Vite alias stub for `next/font/google` (see vite.config.ts `resolve.alias`).
 *
 * The lib's `./fonts` entry calls `Azeret_Mono(...)` / `DM_Sans(...)` — Next.js
 * compiler macros that a plain bundler can't evaluate. No surface in this example
 * imports `./fonts` (fonts arrive via the `./styles` CSS import), so this stub is a
 * defensive guard: if something transitively pulls a Google font, it resolves to a
 * harmless no-op instead of crashing the build.
 */
type FontResult = { className: string; variable: string; style: { fontFamily: string } }
const noop = (): FontResult => ({ className: '', variable: '', style: { fontFamily: '' } })

export const Azeret_Mono = noop
export const DM_Sans = noop
// Catch-all so any other Google font name also resolves to a no-op.
export default new Proxy({}, { get: () => noop })
