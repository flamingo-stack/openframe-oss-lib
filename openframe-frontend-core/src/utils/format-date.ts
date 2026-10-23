// Locale-aware date/time formatters — mirrors openframe-frontend
// `src/lib/format-date.ts`. Formats follow the user's LOCALE and ZONE
// (e.g. MM/DD/YYYY in en-US vs DD.MM.YYYY in european locales): these back the
// dashboard's client-rendered tables, where "your local time" is the meaning.
//
// Rendered by `formatDateWithTimezone` in `./format` with the viewer zone and
// locale stated explicitly — not by a second set of `Intl` instances here.

import { formatDateWithTimezone, VIEWER_TIMEZONE } from './format';

type DateInput = string | number | Date;

// Shown when the input is missing or unparseable, so callers can pass raw API
// values without a per-call check.
const INVALID_DATE_PLACEHOLDER = '—';

const render = (input: DateInput, fields: Intl.DateTimeFormatOptions): string =>
  formatDateWithTimezone(input, VIEWER_TIMEZONE, fields, { viewerLocale: true }) || INVALID_DATE_PLACEHOLDER;

export const formatDate = (input: DateInput): string => render(input, { dateStyle: 'short' });

export const formatTime = (input: DateInput): string => render(input, { timeStyle: 'short' });
