"use client"

import type * as React from "react"
import { cn } from "../../utils/cn"

/**
 * StackedRowsPanel — a single bordered card that stacks rows inside it.
 *
 * Each row can be:
 * - a single full-width element (e.g. title + subtitle) — pass one column,
 * - N columns (each a value + label, possibly a tag/avatar) — pass several columns,
 * - an arbitrary node (e.g. a nested table) — pass `content`.
 *
 * Border-radius behaviour is handled entirely by the container: `rounded-md` +
 * `overflow-clip` clip the first/last rows to the rounded corners. So a single row
 * rounds all four corners, while many rows visually round only the top corners of
 * the first row and the bottom corners of the last — with no per-row corner logic.
 *
 * Cells render the ODS `value` (`text-h4`) over `label` (`text-h6`) pattern with an
 * optional leading icon, matching the app's detail layouts. Pass a node as `value`
 * (e.g. a `Tag`) to render a status chip with a caption beneath it.
 */

export type PanelColumnAlign = "left" | "center" | "right"
export type PanelHideAt = "md" | "lg" | "xl"

export interface PanelColumn {
  /** Stable key for the column. */
  key: string
  /** Custom cell content (tag, avatar + text, button…). Takes precedence over `value`/`label`. */
  content?: React.ReactNode
  /** Primary value rendered in the ODS h4 style when `content` is not set. */
  value?: React.ReactNode
  /** Secondary label rendered under the value (ODS h6, secondary colour). */
  label?: string
  /** Icon shown before the value. */
  icon?: React.ReactNode
  /** When set, the cell becomes an external link. */
  href?: string
  /** Tailwind width class. Defaults to `flex-[1_0_0] min-w-0`. */
  width?: string
  /** Horizontal alignment of the column content. Defaults to `left`. */
  align?: PanelColumnAlign
  /** Hide the column below this breakpoint (mirrors the DataTable `hideAt` concept). */
  hideAt?: PanelHideAt
}

export interface PanelRow {
  /** Stable key for the row. */
  id: string
  /** One column → full-width row; several columns → a columns row. */
  columns?: PanelColumn[]
  /** Arbitrary content (e.g. a nested table). Takes precedence over `columns`. */
  content?: React.ReactNode
  /** Per-row overrides (e.g. height, or `p-0` for a nested table that should reach the edges). */
  className?: string
}

export interface StackedRowsPanelProps {
  rows: PanelRow[]
  /** Optional uppercase caption rendered above the card. */
  title?: string
  className?: string
}

const ALIGN_CLASS: Record<PanelColumnAlign, string> = {
  left: "justify-start items-start",
  center: "justify-center items-center",
  right: "justify-end items-end",
}

// Horizontal alignment for value/label cells. `left` keeps the default stretch so
// the value/label can truncate; center/right shrink to content and align the cell.
const CELL_ITEMS_ALIGN: Record<PanelColumnAlign, string> = {
  left: "",
  center: "items-center",
  right: "items-end",
}

const HIDE_CLASS: Record<PanelHideAt, string> = {
  md: "hidden md:flex",
  lg: "hidden lg:flex",
  xl: "hidden xl:flex",
}

// Base column-row class. Row height is content-driven via the min-heights, matching
// the joined-row pattern used across the detail layouts (56px mobile, 80px tablet+).
const ROW_CLASS =
  "flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 md:min-h-20 border-b border-ods-border last:border-b-0"

function CellValue({ column }: { column: PanelColumn }) {
  const valueNode = (
    <div
      className="text-ods-text-primary text-h4 truncate"
      title={typeof column.value === "string" ? column.value : undefined}
    >
      {column.value}
    </div>
  )

  return (
    <>
      <div className="flex items-center gap-[var(--spacing-system-xxs)] min-w-0">
        {column.icon && <span className="shrink-0">{column.icon}</span>}
        {column.href ? (
          <a
            href={column.href}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 transition-opacity hover:opacity-80"
          >
            {valueNode}
          </a>
        ) : (
          valueNode
        )}
      </div>
      {column.label ? <p className="text-ods-text-secondary text-h6 truncate">{column.label}</p> : null}
    </>
  )
}

function PanelCell({ column }: { column: PanelColumn }) {
  const widthClass = column.width ?? "flex-[1_0_0] min-w-0"
  const hideClass = column.hideAt ? HIDE_CLASS[column.hideAt] : "flex"

  if (column.content !== undefined) {
    return (
      <div className={cn(hideClass, "flex-col", ALIGN_CLASS[column.align ?? "left"], widthClass)}>{column.content}</div>
    )
  }

  return (
    <div className={cn(hideClass, "flex-col justify-center", CELL_ITEMS_ALIGN[column.align ?? "left"], widthClass)}>
      <CellValue column={column} />
    </div>
  )
}

function PanelRowView({ row }: { row: PanelRow }) {
  // Arbitrary content (e.g. a nested table): keep it edge-to-edge unless the caller
  // overrides via `className`. No fixed height — let the content size itself.
  if (row.content !== undefined) {
    return <div className={cn("border-b border-ods-border last:border-b-0", row.className)}>{row.content}</div>
  }

  const columns = row.columns ?? []
  const isFullWidth = columns.length === 1

  // A single-column row is a full-width title/subtitle row: pad symmetrically
  // (ODS `m`) instead of using a fixed column-row height.
  const rowClass = isFullWidth
    ? cn(
        "flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] border-b border-ods-border last:border-b-0",
        row.className,
      )
    : cn(ROW_CLASS, row.className)

  return (
    <div className={rowClass}>
      {columns.map(column => (
        <PanelCell key={column.key} column={column} />
      ))}
    </div>
  )
}

export function StackedRowsPanel({ rows, title, className }: StackedRowsPanelProps) {
  const card = (
    <div className="flex flex-col overflow-clip rounded-md border border-ods-border bg-ods-card">
      {rows.map(row => (
        <PanelRowView key={row.id} row={row} />
      ))}
    </div>
  )

  if (!title) {
    return <div className={className}>{card}</div>
  }

  return (
    <div className={cn("flex flex-col gap-[var(--spacing-system-xxs)]", className)}>
      <p className="text-h5 uppercase text-ods-text-secondary">{title}</p>
      {card}
    </div>
  )
}
