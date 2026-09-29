/**
 * The footer copyright line: `© <year> <legal name>. All rights reserved.`
 * ONE owner, so a legal name that already ends in a period ("Flamingo AI, Inc.")
 * never renders a double period.
 */
export function copyrightLine(legalName: string, year: number = new Date().getFullYear()): string {
  const name = legalName.trim();
  const sentenceEnd = /[.!?]$/.test(name) ? '' : '.';
  return `© ${year} ${name}${sentenceEnd} All rights reserved.`;
}
