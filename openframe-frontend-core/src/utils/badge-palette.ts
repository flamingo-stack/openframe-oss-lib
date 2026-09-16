/**
 * The ODS badge palette: the `StatusBadge` colour schemes a row whose colour is
 * DATA picks from (a department today). Every entry is built from ODS tokens
 * only, five brand and attention hues, each as a solid and a soft fill, so no
 * two entries look alike. A stored colour is one of these KEYS, never a hex.
 */
export const BADGE_PALETTE = [
  'cyan',
  'cyanSoft',
  'pink',
  'pinkSoft',
  'openYellow',
  'warning',
  'green',
  'success',
  'red',
  'error',
] as const;

export type BadgePaletteKey = (typeof BADGE_PALETTE)[number];

export function isBadgePaletteKey(value: unknown): value is BadgePaletteKey {
  return typeof value === 'string' && (BADGE_PALETTE as readonly string[]).includes(value);
}

/**
 * A random palette key for a new row, preferring one no row in `avoid` uses yet.
 * Repeats a colour only once every colour is taken. `random` is injectable for tests.
 */
export function pickBadgePaletteColor({
  avoid = [],
  random = Math.random,
}: { avoid?: ReadonlyArray<string | null | undefined>; random?: () => number } = {}): BadgePaletteKey {
  const used = new Set(avoid);
  const free = BADGE_PALETTE.filter(key => !used.has(key));
  const pool = free.length > 0 ? free : BADGE_PALETTE;
  return pool[Math.floor(random() * pool.length) % pool.length];
}
