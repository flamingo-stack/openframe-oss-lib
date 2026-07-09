// Locale-aware date/time formatters — mirrors openframe-frontend
// `src/lib/format-date.ts`. Formats follow the user's locale
// (e.g. MM/DD/YYYY in en-US vs DD.MM.YYYY in european locales).

type DateInput = string | number | Date;

const toDate = (input: DateInput): Date => (input instanceof Date ? input : new Date(input));

// Shown when the input is missing or unparseable. `Intl.DateTimeFormat.format`
// throws `RangeError: Invalid time value` on an invalid Date, so every formatter
// here guards first — callers can pass raw API values without a per-call check.
const INVALID_DATE_PLACEHOLDER = '—';

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' });
const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

const format = (input: DateInput, fmt: Intl.DateTimeFormat): string => {
  const date = toDate(input);
  return Number.isNaN(date.getTime()) ? INVALID_DATE_PLACEHOLDER : fmt.format(date);
};

export const formatDate = (input: DateInput): string => format(input, dateFmt);

export const formatTime = (input: DateInput): string => format(input, timeFmt);
