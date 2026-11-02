/**
 * The `[N]` citation chip grammar: a model may type a number into its text, and nothing stores one. A citation is
 * structured data on a text part (`./chat-message`), and its number is drawn from reading order (`./citations`). This is
 * what the server's stream and the fill of old rows remove, and what `./old-wire` reads off an older backend.
 *
 * A chip names a retrieved source by its number: `[1]`, a comma list in one bracket (`[2, 3]`), or a run of them
 * (`[1][2]`). A run counts as citations only when it stands apart from a word: whitespace or the start before it,
 * whitespace, punctuation or the end after it, so `array[1]` or `foo[12]bar` in prose stays as written.
 *
 * Server-safe: no React, no browser APIs.
 */

/** One bracket: a number of one or two digits, or a comma list of them. */
const CHIP = '\\[\\d{1,2}(?:\\s*,\\s*\\d{1,2})*\\]';

/** A run of chips, and what may follow it: the grammar, for a reader that walks a text as it arrives. */
export const CITATION_CHIP_RUN = `(?:${CHIP})+`;
export const CITATION_CHIP_FOLLOW = '[\\s.,;:!?)\\]]';

/** A run of chips standing apart from a word; group 1 is the whitespace (or nothing) before it. */
function chipRunScanner(): RegExp {
  return new RegExp(`(^|\\s)${CITATION_CHIP_RUN}(?=${CITATION_CHIP_FOLLOW}|$)`, 'g');
}

/**
 * The text with its citation chips removed. A run goes with the spaces before it, so "the command [1]." reads
 * "the command." and "the guide [3] covers it" reads "the guide covers it"; a line break before a run stays.
 */
export function stripCitationChips(text: string): string {
  return text.replace(chipRunScanner(), (_run: string, lead: string) => (lead === ' ' || lead === '\t' ? '' : lead));
}
