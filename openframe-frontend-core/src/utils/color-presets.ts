/**
 * THE colour palette for data that carries its own colour: ticket statuses picked
 * in `ColorPresetSelect`, a department's badge, any future row with an identity
 * colour. One list, so every coloured badge in the product reads from the same
 * design-system swatches.
 */

export interface ColorPreset {
  key: string;
  label: string;
  color: string;
}

export const COLOR_PRESETS: readonly ColorPreset[] = [
  { key: 'green', label: 'Green', color: '#5ea62e' },
  { key: 'lime', label: 'Lime', color: '#8bc34a' },
  { key: 'teal', label: 'Teal', color: '#4db6ac' },
  { key: 'sky', label: 'Sky', color: '#4fc3f7' },
  { key: 'periwinkle', label: 'Periwinkle', color: '#7e9cd8' },
  { key: 'lavender', label: 'Lavender', color: '#b39ddb' },
  { key: 'yellow', label: 'Yellow', color: '#e1b32f' },
  { key: 'sand', label: 'Sand', color: '#f0c674' },
  { key: 'peach', label: 'Peach', color: '#f39c7a' },
  { key: 'red', label: 'Red', color: '#f36666' },
  { key: 'pink', label: 'Pink', color: '#e988a8' },
  { key: 'neutral', label: 'Neutral', color: '#b0b0b0' },
];

/** The preset a key names, or `undefined`. */
export function colorPreset(key: string | null | undefined): ColorPreset | undefined {
  return key ? COLOR_PRESETS.find(preset => preset.key === key) : undefined;
}

/**
 * A random preset key for a new row that needs an identity colour. Prefers a
 * preset nobody in `avoid` uses yet (neutral is never picked: it reads as "no
 * colour"); once every colour is taken, any colour may repeat.
 */
export function pickPresetColor({
  avoid = [],
  random = Math.random,
}: { avoid?: ReadonlyArray<string | null | undefined>; random?: () => number } = {}): string {
  const colours = COLOR_PRESETS.filter(preset => preset.key !== 'neutral');
  const used = new Set(avoid);
  const free = colours.filter(preset => !used.has(preset.key));
  const pool = free.length > 0 ? free : colours;
  return pool[Math.floor(random() * pool.length) % pool.length].key;
}
