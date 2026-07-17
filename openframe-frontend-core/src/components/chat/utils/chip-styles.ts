/**
 * Shared className generator for the chat-adjacent UI family:
 *  - **Source chips** (citation list below an assistant turn)
 *  - **Inline entity-card pills** (within prose, marker-rendered)
 *  - **Search-result rows** (dropdown beneath the search input)
 *
 * Centralising the token here means a single ODS change propagates to
 * every surface — chip / card / dropdown row read as the same family.
 *
 * The `tone` arg controls the resting text color:
 *  - `secondary` — citation chips and tertiary metadata. Muted resting.
 *  - `primary`   — chips that ARE the subject of the sentence. Matches
 *    body text color so the chip reads as content, not metadata.
 *
 * The `density` arg controls size / padding:
 *  - `'chip'`     — inline pill (`px-2 py-0.5 text-[11px]`). Default;
 *    used by the citation row and inline entity-card markers.
 *  - `'list-row'` — wider, taller row (`px-3 py-2 text-sm`). Used by
 *    the search-bar dropdown. Same ODS family — same border, hover
 *    transition, accent treatment — just larger touch target.
 *  - `'card-row'` — for the tracking strip beneath a card frame
 *    (`px-2 py-1 text-[11px]` no border). Same family, no frame.
 */
export interface ChipClassOptions {
  tone: 'primary' | 'secondary'
  /** Visual density. Defaults to `'chip'`. */
  density?: 'chip' | 'list-row' | 'card-row'
  /** Extra classes appended verbatim (e.g. `cursor-pointer`). */
  extra?: string
}

export function chatChipClass({ tone, density = 'chip', extra }: ChipClassOptions): string {
  const toneClass = tone === 'primary' ? 'text-ods-text-primary' : 'text-ods-text-secondary'
  // Size / padding by density. All three share the same border + hover
  // semantics so a chip and a search-row read as the same UI family.
  const sizeClass = density === 'list-row'
    ? 'px-3 py-2 text-sm gap-2'
    : density === 'card-row'
      ? 'px-2 py-1 text-h6 gap-1.5'
      : 'px-2 py-0.5 text-h6 gap-1.5'
  // `card-row` is the "no-frame" variant — no border, no card bg, so it
  // sits cleanly under a card without visually wrapping it.
  const frameClass = density === 'card-row'
    ? ''
    : 'bg-ods-card border border-ods-border rounded'
  const base =
    `inline-flex items-center ${sizeClass} ${frameClass} ` +
    `${toneClass} ` +
    'hover:text-ods-accent hover:border-ods-accent transition-colors align-baseline'
  return extra ? `${base} ${extra}` : base
}
