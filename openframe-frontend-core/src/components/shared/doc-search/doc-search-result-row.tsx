'use client'

/**
 * Single row in the `<SearchInput>` dropdown — the standard layout
 * used by every doc-search-backed surface (company-hub data-room
 * search bar, onboarding-guide catalog search, …). Single source of
 * truth for the row appearance so search dropdowns are visually
 * identical everywhere.
 *
 * Resolves the source icon via the same `resolveSourceIcon()`
 * registry the inline chat-card refs use, so a row pointing at e.g.
 * an onboarding-guide surfaces the SAME `<GraduationCap>` glyph the
 * chat card surfaces — no cross-surface drift.
 */

import { resolveSourceIcon } from '../../chat/utils/source-row-cta'
import { formatRelativePath } from './format-relative-path'

/**
 * Minimal result shape this row renders. Compatible with any
 * doc-search hook whose result type exposes `{ title?, path?,
 * metadata? }`. The two hub consumers (onboarding-guide catalog,
 * data-room sidebar) both satisfy this shape via their
 * `useDocSearch` hook result.
 */
export interface DocSearchResultRowEntry {
  title?: string
  path?: string
  metadata?: Record<string, unknown>
}

export interface DocSearchResultRowProps {
  result: DocSearchResultRowEntry
  isHighlighted: boolean
}

export function DocSearchResultRow({
  result,
  isHighlighted,
}: DocSearchResultRowProps) {
  const docType = (result.metadata?.documentType as string) || undefined
  const sourceRepo = (result.metadata?.sourceRepo as string) || undefined
  const { Icon: SourceIcon, label: iconLabel } = resolveSourceIcon({
    sourceRepo,
    documentType: docType,
  })
  const isGroup = result.metadata?.isGroup as boolean | undefined

  return (
    <div className="flex items-center gap-3 w-full min-w-0">
      <span
        className="flex-shrink-0 text-ods-text-secondary"
        title={iconLabel}
      >
        <SourceIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`text-sm font-medium leading-5 truncate ${
            isHighlighted ? 'text-ods-accent' : 'text-ods-text-primary'
          }`}
        >
          {result.title || result.path}
        </div>
        {!isGroup && result.path?.includes('/') && (
          <div className="text-xs leading-4 text-ods-text-secondary truncate mt-0.5">
            {formatRelativePath(result.path)}
          </div>
        )}
      </div>
    </div>
  )
}
