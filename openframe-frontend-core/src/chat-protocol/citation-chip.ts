/**
 * The `[N]` citation chip grammar: ONE definition for the server that writes chips into an answer and the clients
 * that read them (the strip of cited sources) or hide them (beside cards).
 *
 * A chip names a retrieved source by its number: `[1]`, a comma list in one bracket (`[2, 3]`), or a run of them
 * (`[1][2]`). A run counts as citations only when it stands apart from a word: whitespace or the start before it,
 * whitespace, punctuation or the end after it, so `array[1]` or `foo[12]bar` in prose stays as written.
 *
 * Server-safe: no React, no browser APIs.
 */

/** One bracket: a number of one or two digits, or a comma list of them. */
const CHIP = '\\[\\d{1,2}(?:\\s*,\\s*\\d{1,2})*\\]';

/** A run of chips standing apart from a word; group 1 is the whitespace (or nothing) before it. */
function chipRunScanner(): RegExp {
  return new RegExp(`(^|\\s)(?:${CHIP})+(?=[\\s.,;:!?)\\]]|$)`, 'g');
}

/** The chips for these source numbers: `[1][3]`, each number once, in ascending order. */
export function formatCitationChips(numbers: Iterable<number>): string {
  return [...new Set(numbers)]
    .sort((a, b) => a - b)
    .map(n => `[${n}]`)
    .join('');
}

/**
 * The text with its citation chips removed. A run goes with the spaces before it, so "the command [1]." reads
 * "the command." and "the guide [3] covers it" reads "the guide covers it"; a line break before a run stays.
 */
export function stripCitationChips(text: string): string {
  return text.replace(chipRunScanner(), (_run: string, lead: string) => (lead === ' ' || lead === '\t' ? '' : lead));
}

/** The source numbers a text cites, in the order it first cites them, each once. */
export function citedSourceNumbers(text: string): number[] {
  const numbers: number[] = [];
  for (const run of text.matchAll(chipRunScanner())) {
    for (const digits of run[0].matchAll(/\d+/g)) {
      const n = Number.parseInt(digits[0], 10);
      if (!numbers.includes(n)) numbers.push(n);
    }
  }
  return numbers;
}
