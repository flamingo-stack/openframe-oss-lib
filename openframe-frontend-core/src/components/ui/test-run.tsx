'use client'

import type { ColumnDef, Row } from '@tanstack/react-table'
import * as React from 'react'
import { Copy02Icon, SearchIcon } from '../icons-v2-generated'
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard'
import { cn } from '../../utils/cn'
import { formatTime } from '../../utils/format-date'
import { DataTable } from './data-table'
import { useDataTable } from './data-table/use-data-table'
import { NoData } from './no-data'
import type { QueryResultRow } from './query-report-table'
import { ScrollShadow } from './scroll-fade'
import { Tag } from './tag'

/*
 * Live test-run building blocks: the UI (timing stats, one-row skeleton,
 * results table) and the run state machine for "run a query/script somewhere
 * and stream tabular results back" flows. The transport is NOT part of this
 * module — consumers own campaign creation (Fleet live queries, script runs,
 * ...) and pass a `TestRunCampaignState`-shaped object into
 * `useTestRunState`.
 */

export function formatTestRunDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const RESULT_COLUMN_MIN_WIDTH = 176
const SKELETON_COLUMNS = 6

/** Column-bar skeleton (header cells + one card row): fixed 160px columns on
    every breakpoint, scrolling horizontally when they do not fit. Bars use
    bg-ods-bg-surface like the table skeletons — the bg-ods-skeleton token is
    the same color as the card background and would be invisible on the row. */
export function TestResultsSkeleton() {
  return (
    <ScrollShadow axis="horizontal">
      {/* No gap between the header bars and the row card — the real table's
          header and body sit flush. */}
      <div className="flex w-max min-w-full flex-col">
        <div className="flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]">
          {Array.from({ length: SKELETON_COLUMNS }).map((_, i) => (
            <div key={`skeleton-header-${i}`} className="flex h-12 w-[160px] shrink-0 items-center">
              <div className="h-4 w-3/4 rounded-sm bg-ods-bg-surface animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-[6px] border border-ods-border bg-ods-card overflow-hidden animate-pulse">
          {/* Same INNER row heights as the DataTable (66/78px + the 1px card
              border on each side = 68/80px total, per design). */}
          <div className="flex h-[66px] md:h-[78px] items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]">
            {Array.from({ length: SKELETON_COLUMNS }).map((_, i) => (
              <div key={`skeleton-cell-${i}`} className="w-[160px] shrink-0">
                <div className="h-5 w-3/4 rounded-sm bg-ods-bg-surface" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollShadow>
  )
}

/**
 * Live test results rendered with the core DataTable (identical header,
 * skeleton, and card-row styling to the standard tables). Columns are derived
 * from the keys of the returned rows; wide result sets scroll horizontally.
 * Unlike the default tables, headers stay visible on every breakpoint.
 */
export function TestResultsTable({ rows, loading }: { rows: QueryResultRow[]; loading: boolean }) {
  const columnKeys = React.useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows])

  const columns = React.useMemo<ColumnDef<QueryResultRow>[]>(() => {
    return columnKeys.map(key => ({
      id: key,
      accessorFn: (row: QueryResultRow) => row[key],
      header: key,
      enableSorting: false,
      cell: ({ row }: { row: Row<QueryResultRow> }) => {
        const value = row.original[key]
        return (
          <span className="text-h4 text-ods-text-primary truncate">
            {value === null || value === undefined ? '-' : String(value)}
          </span>
        )
      },
      meta: {
        width: 'flex-1 min-w-[176px]',
        // Show headers on every breakpoint; headerClassName sizes the cells
        // below lg where meta.width is not applied.
        alwaysShowHeader: true,
        headerClassName: 'flex-1 min-w-[176px]',
      },
    }))
  }, [columnKeys])

  const table = useDataTable<QueryResultRow>({
    data: rows,
    columns,
    getRowId: (_row: QueryResultRow, index: number) => String(index),
    enableSorting: false,
  })

  if (loading) {
    return <TestResultsSkeleton />
  }

  return (
    <ScrollShadow axis="horizontal">
      <div style={{ minWidth: Math.max(1, columnKeys.length) * RESULT_COLUMN_MIN_WIDTH }}>
        <DataTable table={table}>
          {/* "flex" overrides the header's default "hidden md:flex" so the
              headers render on mobile too. */}
          <DataTable.Header className="flex flex-col" />
          <DataTable.Body loading={false} />
        </DataTable>
      </div>
    </ScrollShadow>
  )
}

export interface TestRunResultsProps {
  isActive: boolean
  displayRows: QueryResultRow[]
  firstError: string | null
  className?: string
}

/** Red error banner with a copy-to-clipboard action, per the test-run design. */
export function TestRunErrorBanner({ error, className }: { error: string; className?: string }) {
  const { copy } = useCopyToClipboard({ successDescription: 'Error message copied to clipboard' })
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between gap-[var(--spacing-system-s)]',
        'rounded-md border border-ods-error bg-ods-error-secondary',
        'px-[var(--spacing-system-mf)] py-[var(--spacing-system-s)]',
        className,
      )}
    >
      <p className="text-h4 text-ods-error min-w-0 break-words">{error}</p>
      <button
        type="button"
        aria-label="Copy error message"
        onClick={() => copy(error)}
        className="shrink-0 text-ods-error hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus rounded-sm"
      >
        <Copy02Icon className="size-5" />
      </button>
    </div>
  )
}

/** Error line + empty state + result table for a finished/running test run. */
export function TestRunResults({ isActive, displayRows, firstError, className }: TestRunResultsProps) {
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-xsf)]', className)}>
      {firstError && <TestRunErrorBanner error={firstError} />}
      {!isActive && displayRows.length === 0 ? (
        // With zero rows the error line alone explains the outcome; a
        // "No results returned" empty state next to it would mislead.
        // Otherwise: fixed-height empty state matching the 1-row
        // skeleton/result height (48px header + 80px row, no gap) so the
        // block does not jump between loading/result/empty.
        !firstError && (
          <NoData icon={<SearchIcon />} title="No results returned" className="h-[128px] justify-center !py-0" />
        )
      ) : (
        <TestResultsTable rows={displayRows} loading={isActive && displayRows.length === 0} />
      )}
    </div>
  )
}

/** Started / Duration stat cell shown in a test-run controls row. */
export function TimingStat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn('flex flex-col justify-center min-w-0', className)}>
      <span className="text-h4 text-ods-text-secondary truncate">{value}</span>
      <span className="text-h6 text-ods-text-secondary truncate">{label}</span>
    </div>
  )
}

/** Overall run outcome shown in a test-run controls row. */
export type TestRunStatus = 'idle' | 'running' | 'success' | 'error'

const TEST_RUN_STATUS_TAGS: Record<Exclude<TestRunStatus, 'idle'>, { label: string; variant: 'warning' | 'success' | 'error' }> = {
  running: { label: 'IN PROCESS', variant: 'warning' },
  success: { label: 'SUCCESS', variant: 'success' },
  error: { label: 'ERROR', variant: 'error' },
}

/** Status stat cell: "-" before the first run, then a colored state tag. */
export function TestRunStatusStat({ status, className }: { status: TestRunStatus; className?: string }) {
  const tag = status === 'idle' ? null : TEST_RUN_STATUS_TAGS[status]
  return (
    <div className={cn('flex flex-col justify-center items-start min-w-0 gap-[var(--spacing-system-xxs)]', className)}>
      {tag ? (
        <Tag label={tag.label} variant={tag.variant} className="pointer-events-none" />
      ) : (
        <span className="text-h4 text-ods-text-secondary truncate">-</span>
      )}
      <span className="text-h6 text-ods-text-secondary truncate">Status</span>
    </div>
  )
}

/**
 * The transport-side contract `useTestRunState` observes. Matches the shape
 * of a live-campaign hook (e.g. Fleet live queries in OpenFrame) without
 * depending on any concrete backend.
 */
export interface TestRunCampaignState {
  isRunning: boolean
  startedAt: Date | null
  /** '' before the first run, then 'pending' → 'finished'. */
  campaignStatus: string
  results: QueryResultRow[]
  errors: Array<{ error: string }>
  stopCampaign: () => void
}

/**
 * State machine for one live test run: wraps a campaign-shaped object with
 * the run/stop/reset flow, elapsed-duration ticking, and the display flags
 * test panels render from. The consumer starts the actual campaign inside the
 * `start` callback passed to `run`:
 *
 * ```tsx
 * const campaign = useLiveCampaign()               // app-owned transport
 * const test = useTestRunState(campaign)
 * const handleRun = () => test.run(() => campaign.startCampaign(sql, [hostId]))
 * ```
 */
export function useTestRunState(campaign: TestRunCampaignState) {
  // Sticky "a run has been started" flag: campaignStatus resets to '' for a
  // moment when a new run starts, which would flash the initial Run button
  // between "Test Again" clicks without it.
  const [hasRun, setHasRun] = React.useState(false)
  // True while the campaign is being created (before isRunning flips) —
  // without it the button would flash "Test Again" right after a Run click.
  const [isStarting, setIsStarting] = React.useState(false)
  const [durationMs, setDurationMs] = React.useState(0)

  React.useEffect(() => {
    if (!campaign.startedAt || !campaign.isRunning) {
      if (campaign.startedAt && !campaign.isRunning) {
        setDurationMs(Date.now() - campaign.startedAt.getTime())
      }
      return
    }
    setDurationMs(Date.now() - campaign.startedAt.getTime())
    const interval = setInterval(() => {
      setDurationMs(Date.now() - campaign.startedAt!.getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [campaign.startedAt, campaign.isRunning])

  const run = React.useCallback(async (start: () => Promise<unknown>) => {
    setHasRun(true)
    setDurationMs(0)
    setIsStarting(true)
    try {
      await start()
    } finally {
      setIsStarting(false)
    }
  }, [])

  // Stop/reset also drop isStarting so the Stop button doesn't stay "active"
  // for the moment between the user's click and the pending start promise
  // settling (its finally clears the flag again — harmless).
  const stop = React.useCallback(() => {
    setIsStarting(false)
    campaign.stopCampaign()
  }, [campaign.stopCampaign])

  /** Stop anything in flight and clear the run state (panel close/cancel). */
  const reset = React.useCallback(() => {
    setIsStarting(false)
    campaign.stopCampaign()
    setDurationMs(0)
    setHasRun(false)
  }, [campaign.stopCampaign])

  const isActive = campaign.isRunning || isStarting
  const isFinished = campaign.campaignStatus === 'finished'
  const showResults = isActive || (hasRun && isFinished)

  const firstError = isFinished && campaign.errors.length > 0 ? campaign.errors[0].error : null

  // Overall run outcome for the Status stat: '-' until a run starts, then
  // IN PROCESS while active, and SUCCESS/ERROR once the campaign finishes.
  const status: TestRunStatus = isActive ? 'running' : hasRun && isFinished ? (firstError ? 'error' : 'success') : 'idle'

  // Started/Duration show zeros until the current run's timing is real:
  // hasRun=false after a reset, and campaignStatus resets while the next
  // run is being created, so stale values never linger on screen.
  const showTiming = hasRun && campaign.startedAt !== null && (campaign.isRunning || isFinished)

  const startedLabel = showTiming && campaign.startedAt ? formatTime(campaign.startedAt) : '00:00 PM'
  const durationLabel = showTiming ? formatTestRunDuration(durationMs) : '00:00:00'

  // Humanize raw result keys for the table headers (snake_case -> spaced
  // words); the row data itself is shown exactly as returned.
  const displayRows = React.useMemo<QueryResultRow[]>(
    () =>
      campaign.results.map(row =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_/g, ' '), value])),
      ),
    [campaign.results],
  )

  return {
    hasRun,
    isActive,
    isFinished,
    showResults,
    status,
    firstError,
    startedLabel,
    durationLabel,
    displayRows,
    run,
    stop,
    reset,
  }
}
