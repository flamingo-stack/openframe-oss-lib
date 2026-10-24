'use client';

import type { MouseEvent, ReactNode } from 'react';
import { formatNumber } from '../../utils/format';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { FloatingTooltip } from './floating-tooltip';
import { LoadingWhen, useLoadingScope } from './loading-scope';

/**
 * THE trend beside a number: a small trendline of its recent values and its change since the previous value, with
 * the number's full history in a hover card. Built for tables and stat cards (one per cell): an inline SVG, no chart
 * library.
 *
 * - **Lazy history.** `details` is a function, called only while the hover card is open, so a component that reads
 *   the full history (a fetch on mount) loads it on hover and never for the rows nobody points at.
 * - **Loading.** In a loading scope (the page's, or the host's read through `LoadingWhen`) the trendline draws its own
 *   skeleton at its loaded size; with no values it draws the same box empty. Nothing moves when the data lands.
 * - **Colour is earned, as a TONE** (`TrendTone`): a change for the better is `positive`, for the worse `negative`, none
 *   `neutral`. Each tone is an ODS token (`TREND_TONES`: success, error, secondary text) a host may replace for one
 *   trendline (`tones`). Whether a rise is good is the host's to say (`higherIsBetter`): most numbers a monitor shows
 *   count problems.
 *
 * `TrendHistory` is the hover card's body: a title and a grid of columns, one height loading and loaded.
 */

const SPARK_W = 56;
const SPARK_H = 16;
const SPARK_CLASS = 'h-4 w-14';
const CHANGE_CLASS = 'w-8 text-right text-h6 tabular-nums';
const BOX_CLASS = 'inline-flex shrink-0 items-center gap-[var(--spacing-system-xxs)]';

/** The change written with its sign: "+3", "−2", "0". */
export function formatTrendChange(change: number): string {
  return change === 0 ? '0' : `${change > 0 ? '+' : '−'}${formatNumber(Math.abs(change))}`;
}

/** What a change means: better, worse, or none (or unknown). */
export type TrendTone = 'positive' | 'negative' | 'neutral';

/** THE colour of each tone: the ODS semantic tokens (never a raw palette var). */
export const TREND_TONES: Readonly<Record<TrendTone, string>> = {
  positive: 'text-ods-success',
  negative: 'text-ods-error',
  neutral: 'text-ods-text-secondary',
};

/** The tone of a change: a rise is positive only when `higherIsBetter`; no change (or an unknown one) is neutral. */
export function trendTone(change: number | null, higherIsBetter = false): TrendTone {
  if (change === null || change === 0) return 'neutral';
  return change > 0 === higherIsBetter ? 'positive' : 'negative';
}

/** The text colour of a change: its tone's class, from `TREND_TONES` or the host's `tones`. */
export function trendToneClass(change: number | null, higherIsBetter = false, tones: Partial<Record<TrendTone, string>> = {}): string {
  const tone = trendTone(change, higherIsBetter);
  return tones[tone] ?? TREND_TONES[tone];
}

function Spark({ values, toneClass }: { values: ReadonlyArray<number | null>; toneClass: string }) {
  const known = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => p[1] !== null);
  if (known.length === 0) return <svg className={SPARK_CLASS} aria-hidden="true" />;
  const max = Math.max(...known.map(([, v]) => v), 1);
  const x = (i: number) => (values.length === 1 ? SPARK_W / 2 : (i / (values.length - 1)) * (SPARK_W - 4) + 2);
  const y = (v: number) => SPARK_H - 2 - (v / max) * (SPARK_H - 4);
  const [lastI, lastV] = known[known.length - 1];
  return (
    <svg className={`${SPARK_CLASS} ${toneClass}`} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true">
      {known.length > 1 && (
        <polyline
          points={known.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <circle cx={x(lastI)} cy={y(lastV)} r={2} fill="currentColor" />
    </svg>
  );
}

export interface TrendlineProps {
  /** The values, oldest first; null where a value is unknown. Empty = no history (the box stays, empty). */
  values: ReadonlyArray<number | null>;
  /** What the number is: the accessible name, and what the hover card is about. */
  label: string;
  /** The change shown beside the line. Default: the last value minus the one before (none when either is unknown). */
  change?: number | null;
  /** A rise is good (online devices, revenue). Default: a rise is worse (problems, errors). */
  higherIsBetter?: boolean;
  /** Replace a tone's colour for this trendline (an ODS text class, e.g. `{ positive: 'text-ods-accent' }`). */
  tones?: Partial<Record<TrendTone, string>>;
  /** The hover card's body, called only while it is open (load the full history here). None: no hover card. */
  details?: () => ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Trendline({ values, label, change, higherIsBetter = false, tones, details, side = 'top' }: TrendlineProps) {
  // The ONE switch: in a loading scope, the skeleton at the loaded size.
  if (useLoadingScope()) {
    return (
      <span className={BOX_CLASS} aria-hidden="true">
        <UnifiedSkeleton as="span" className={`${SPARK_CLASS} rounded-sm`} />
        <span className={CHANGE_CLASS} />
      </span>
    );
  }
  if (values.length === 0) {
    return (
      <span className={BOX_CLASS} aria-hidden="true">
        <span className={SPARK_CLASS} />
        <span className={CHANGE_CLASS} />
      </span>
    );
  }
  const last = values[values.length - 1] ?? null;
  const before = values.length > 1 ? (values[values.length - 2] ?? null) : null;
  const delta = change !== undefined ? change : last !== null && before !== null ? last - before : null;
  const toneClass = trendToneClass(delta, higherIsBetter, tones);
  const line = (
    <span
      className={BOX_CLASS}
      // A trendline sits inside clickable cards and rows: pointing at it must not also click them.
      onClick={(e: MouseEvent) => e.stopPropagation()}
      aria-label={`${label}: last ${values.length} values${delta === null ? '' : `, ${formatTrendChange(delta)}`}`}
      role="img"
    >
      <Spark values={values} toneClass={toneClass} />
      <span className={`${CHANGE_CLASS} ${toneClass}`}>{delta === null ? '' : formatTrendChange(delta)}</span>
    </span>
  );
  if (!details) return line;
  return (
    <FloatingTooltip as="span" side={side} triggerClassName={BOX_CLASS} content={<TrendDetails render={details} />}>
      {line}
    </FloatingTooltip>
  );
}

/** Mounted only while the hover card is open, so `render` (and any read it starts) runs on hover. */
function TrendDetails({ render }: { render: () => ReactNode }) {
  return <>{render()}</>;
}

/* ---------------------------------- history --------------------------------- */

export interface TrendHistoryColumn {
  label: string;
  /** Numbers align right. */
  align?: 'left' | 'right';
}

export interface TrendHistoryProps {
  title: string;
  columns: TrendHistoryColumn[];
  /** One row per value, each a cell per column; null while the history loads. */
  rows: ReactNode[][] | null;
  /** Rows drawn while loading (the number of values the trendline already shows). */
  loadingRows: number;
  /** Shown in place of the grid when the history could not be read. */
  error?: string | null;
  /** Anything after the grid (who changed, a link). */
  children?: ReactNode;
}

/**
 * The hover card's body for a `Trendline`: a title, then the history as a grid (the chart tooltips' anatomy: muted
 * headers, primary values). Every row draws its own skeleton cells while `rows` is null, so the card is one height
 * loading and loaded.
 */
export function TrendHistory({ title, columns, rows, loadingRows, error, children }: TrendHistoryProps) {
  const grid = { gridTemplateColumns: `1fr ${'auto '.repeat(Math.max(0, columns.length - 1)).trim()}` };
  const alignClass = (c: TrendHistoryColumn) => (c.align === 'right' ? 'text-right tabular-nums' : 'text-left');
  return (
    <div className="flex w-72 flex-col gap-[var(--spacing-system-sf)] whitespace-normal text-h6">
      <span className="text-ods-text-primary">{title}</span>
      {error ? (
        <span className="text-ods-text-secondary">{error}</span>
      ) : (
        <LoadingWhen loading={rows === null}>
          <div className="grid gap-x-[var(--spacing-system-mf)] gap-y-[var(--spacing-system-xxs)]" style={grid}>
            {columns.map((c) => (
              <span key={c.label} className={`${alignClass(c)} text-ods-text-secondary`}>
                {c.label}
              </span>
            ))}
            {(rows ?? Array.from({ length: loadingRows }, () => null)).map((row, r) =>
              columns.map((c, i) => <TrendHistoryCell key={`${r}:${c.label}`} column={c} value={row ? row[i] : null} />),
            )}
          </div>
        </LoadingWhen>
      )}
      {children}
    </div>
  );
}

function TrendHistoryCell({ column, value }: { column: TrendHistoryColumn; value: ReactNode }) {
  if (useLoadingScope()) return <TextLineSkeleton type="h6" className={column.align === 'right' ? 'ml-auto w-8' : 'w-12'} />;
  return <span className={`${column.align === 'right' ? 'text-right tabular-nums' : 'text-left'} text-ods-text-primary`}>{value}</span>;
}
