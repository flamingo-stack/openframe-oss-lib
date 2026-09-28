/**
 * CSV serialization — ONE quoting rule for every export in the lib and the hub.
 *
 * Beyond RFC-4180 quoting, cells are FORMULA-NEUTRALIZED: a spreadsheet treats a
 * leading `=`, `+`, `-` or `@` as a formula, so an exported value like
 * `=HYPERLINK("http://evil","click")` executes on open (CSV injection). A cell
 * that starts with one of those AND is not a plain numeric literal gets a leading
 * apostrophe, which Excel/Sheets strip on display.
 */

export const CSV_CONTENT_TYPE = 'text/csv;charset=utf-8;';

const NUMERIC_LITERAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const FORMULA_PREFIX = /^[=+\-@]/;

/** Quote + neutralize a single cell. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let cell = String(value);
  if (FORMULA_PREFIX.test(cell) && !NUMERIC_LITERAL.test(cell)) cell = `'${cell}`;
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export interface CsvColumn<TRow> {
  /** Header text (escaped like any other cell). */
  header: string;
  /** Cell value for a row. */
  value: (row: TRow) => unknown;
}

/** Serialize rows to a CSV document (header + `\n`-joined rows). */
export function toCsv<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): string {
  const header = columns.map(c => csvEscape(c.header)).join(',');
  const body = rows.map(row => columns.map(c => csvEscape(c.value(row))).join(','));
  return [header, ...body].join('\n');
}
