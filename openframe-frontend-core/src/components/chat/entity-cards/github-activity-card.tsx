'use client'

/**
 * GitHub Activity Card — unified visual for commits, PRs, and PR reviews.
 *
 * PURE PRESENTATION (no internal nav, no internal data fetching). The card
 * receives the structured `<a>` prop bundle via `anchorProps` (composed by
 * the caller from a runtime hook) and renders the rest from the
 * `GitHubActivityItem` shape directly.
 *
 * Two consumers share this component:
 *   1. Activity-list row (employee detail / similar) — pass `variant="row"`.
 *   2. Chat-inline `[card://github_commit:<sha>]` markers — `variant="compact"`.
 *
 * Unified data shape `GitHubActivityItem` covers all three GitHub types
 * (commit / PR / review).
 */

import React from 'react'
import { GitHubIcon } from '../../icons/github-icon'
import { GitPullRequest, Eye, ExternalLink } from 'lucide-react'
import {
  COMPACT_CARD_ICON_SLOT,
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
  safeHref,
} from '../utils/compact-card-classes'
import { formatDateUTC as formatDate } from '../../../utils/format'
import type {
  GitHubActivityItem,
  GitHubActivityKind,
  PrReviewState,
} from '../types/entities/github-activity'

/** Extract owner/repo from a GitHub URL. */
function parseRepoFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.host !== 'github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
  } catch {
    /* malformed URL */
  }
  return null
}

function kindIcon(kind: GitHubActivityKind, className = 'h-4 w-4') {
  switch (kind) {
    case 'pull_request':
      return <GitPullRequest className={`${className} shrink-0`} />
    case 'pr_review':
      return <Eye className={`${className} shrink-0`} />
    case 'commit':
    default:
      return <GitHubIcon className={`${className} shrink-0`} />
  }
}

export function kindLabel(kind: GitHubActivityKind): string {
  switch (kind) {
    case 'pull_request': return 'PR'
    case 'pr_review': return 'Review'
    case 'commit':
    default: return 'Commit'
  }
}

export function formatActivityId(id: string, kind: GitHubActivityKind): string {
  if (!id) return ''
  if (kind === 'pull_request' || kind === 'pr_review') return `#${id}`
  if (/^[0-9a-f]{40}$/i.test(id)) return id.slice(0, 7)
  return id.length > 12 ? id.slice(0, 12) : id
}

export function parseGithubTitle(title: string, kind: GitHubActivityKind): { display: string; reviewState: PrReviewState | null } {
  if (!title) return { display: '', reviewState: null }

  // Split prefix-tag from rest by hand instead of one giant regex.
  // Avoids polynomial-redos on chained `\s*` quantifiers (`\[\s*X\s*\]`),
  // since multiple consecutive `\s*` groups against long whitespace runs
  // trigger exponential backtracking on CodeQL's heuristic.
  //
  // Algorithm: trim; if it starts with `[`, locate the matching `]`,
  // then content[0:closing] is the tag, content[closing+1:] is the
  // remainder. Linear scan — no regex backtracking possible.
  const trimmed = title.trim()
  let tag: string | null = null
  let rest: string = trimmed
  if (trimmed.startsWith('[')) {
    const close = trimmed.indexOf(']')
    if (close > 0) {
      tag = trimmed.slice(1, close).trim().toLowerCase()
      rest = trimmed.slice(close + 1).trim()
    }
  }

  if (kind === 'pr_review' && tag && tag.startsWith('review:')) {
    const stateRaw = tag.slice('review:'.length).trim().toUpperCase()
    const reviewState = (['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'] as PrReviewState[]).includes(stateRaw as PrReviewState)
      ? (stateRaw as PrReviewState)
      : null
    return { display: rest || 'Review', reviewState }
  }
  if (kind === 'pull_request' && tag && tag.startsWith('pr')) {
    // Accept `[PR #123]`, `[PR#123]`, `[ pr # 123 ]` etc. — anything
    // matching `pr` followed by `#?\s*\d+`. Validate the suffix is
    // a numeric PR id, not arbitrary text.
    const after = tag.slice(2).trim().replace(/^#\s*/, '')
    if (after.length > 0 && /^\d+$/.test(after)) {
      return { display: rest || title, reviewState: null }
    }
  }
  if (kind === 'commit' && tag === 'commit') {
    return { display: rest || title, reviewState: null }
  }
  return { display: title.trim(), reviewState: null }
}

const REVIEW_STATE_STYLE: Record<PrReviewState, { label: string; className: string }> = {
  APPROVED: {
    label: 'Approved',
    className: 'bg-[var(--ods-attention-green-success-secondary)] text-[var(--ods-attention-green-success)]',
  },
  CHANGES_REQUESTED: {
    label: 'Changes',
    className: 'bg-[var(--ods-attention-red-error-secondary)] text-[var(--ods-attention-red-error)]',
  },
  COMMENTED: {
    label: 'Comment',
    className: 'bg-ods-bg-secondary text-ods-text-primary',
  },
  DISMISSED: {
    label: 'Dismissed',
    className: 'bg-ods-bg-secondary text-ods-text-secondary',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-[var(--ods-attention-yellow-warning-secondary)] text-[var(--ods-attention-yellow-warning)]',
  },
}

/** Short review-state label ("APPROVED" → "Approved") shared with the
 *  MingoInfoCard dispatch mapping so both surfaces read identically. */
export function reviewStateLabel(state: PrReviewState): string {
  return (REVIEW_STATE_STYLE[state] ?? REVIEW_STATE_STYLE.COMMENTED).label
}

function ReviewStateBadge({ state, className = '' }: { state: PrReviewState; className?: string }) {
  const { label, className: paint } = REVIEW_STATE_STYLE[state] ?? REVIEW_STATE_STYLE.COMMENTED
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide shrink-0 ${paint} ${className}`}
    >
      {label}
    </span>
  )
}

export interface GitHubActivityCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface GitHubActivityCardProps {
  item: GitHubActivityItem
  variant?: 'row' | 'compact'
  className?: string
  /** Pre-composed `<a>` prop bundle (typically from a `useNavLink` hook in
   *  the consumer). When provided, the outer renders as a real `<a>`. */
  anchorProps?: GitHubActivityCardAnchorProps
}

export function GitHubActivityCard({ item, variant = 'compact', className, anchorProps }: GitHubActivityCardProps) {
  const kind = item.kind ?? 'commit'
  const repo = item.repo ?? parseRepoFromUrl(item.url) ?? ''
  const dateText = formatDate(item.dateUpdated, { fallback: '', timezone: 'local' })
  const idLabel = formatActivityId(item.id, kind)
  const { display: title, reviewState } = parseGithubTitle(item.title, kind)
  const primaryText = kind === 'pr_review'
    ? (title.replace(/^by\s+/i, '').trim() || 'Reviewer')
    : title

  if (variant === 'row') {
    return (
      <div className={`flex items-center gap-3 min-w-0 ${className ?? ''}`}>
        <span className="flex items-center gap-2 w-28 shrink-0">
          {kindIcon(kind, 'h-3.5 w-3.5')}
          <code className="text-ods-text-secondary font-mono text-xs truncate">{idLabel}</code>
        </span>
        <span className="flex items-center gap-2 text-ods-text-primary text-sm flex-1 min-w-0">
          {reviewState ? <ReviewStateBadge state={reviewState} /> : null}
          <span className="truncate">{primaryText}</span>
        </span>
        {repo ? (
          <span className="font-mono text-[11px] text-ods-text-secondary truncate max-w-[240px] shrink-0">{repo}</span>
        ) : null}
        {dateText ? (
          <span className="text-ods-text-secondary text-xs w-24 shrink-0 text-right">{dateText}</span>
        ) : null}
      </div>
    )
  }

  const metaParts: React.ReactNode[] = []
  metaParts.push(
    <span key="kind" className="font-medium uppercase tracking-wide text-[10px]">{kindLabel(kind)}</span>,
  )
  if (idLabel) metaParts.push(<code key="id" className="font-mono">{idLabel}</code>)
  if (repo) metaParts.push(<span key="repo" className="font-mono truncate">{repo}</span>)
  if (dateText) metaParts.push(<span key="date" className="whitespace-nowrap">{dateText}</span>)

  const href = safeHref(item.url)
  const body = (
    <>
      <span className={COMPACT_CARD_ICON_SLOT}>
        {kindIcon(kind, 'h-5 w-5')}
      </span>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className={`${COMPACT_CARD_TITLE_ROW} flex-nowrap gap-1.5`}>
          {reviewState ? <ReviewStateBadge state={reviewState} /> : null}
          <span className={COMPACT_CARD_TITLE}>{primaryText}</span>
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_META_ROW}>
            {metaParts.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <span className="text-ods-text-secondary/40 shrink-0">·</span> : null}
                <span className="min-w-0 truncate">{part}</span>
              </React.Fragment>
            ))}
          </span>
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_SUMMARY}>{COMPACT_CARD_ROW_FILLER}</span>
        </span>
      </span>
      {href ? (
        <span className="flex shrink-0 items-center self-start h-5 text-ods-text-secondary">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      ) : null}
    </>
  )
  if (anchorProps) {
    return (
      <a {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </a>
    )
  }
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}
    >
      {body}
    </a>
  ) : (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">{body}</span>
  )
}

export function GitHubActivityCardSkeleton({ variant = 'compact', className }: { variant?: 'row' | 'compact'; className?: string }) {
  if (variant === 'row') {
    return (
      <div className={`flex items-center gap-3 min-w-0 animate-pulse ${className ?? ''}`}>
        <div className="flex items-center gap-2 w-28 shrink-0">
          <div className="h-3.5 w-3.5 rounded bg-ods-bg" />
          <div className="h-3 w-16 bg-ods-bg rounded" />
        </div>
        <div className="h-3 w-2/3 bg-ods-bg rounded flex-1" />
        <div className="h-3 w-40 bg-ods-bg/60 rounded shrink-0" />
        <div className="h-3 w-20 bg-ods-bg/60 rounded shrink-0" />
      </div>
    )
  }
  return (
    <span className={`${COMPACT_CARD_SKELETON_OUTER} ${className ?? ''}`}>
      <span className={COMPACT_CARD_SKELETON_IMAGE_SLOT} />
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className={COMPACT_CARD_TITLE_ROW}>
          <span className="h-3.5 w-2/3 rounded bg-ods-bg" />
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className="h-3 w-1/2 rounded bg-ods-bg/70" />
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className={COMPACT_CARD_SUMMARY}>{COMPACT_CARD_ROW_FILLER}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center self-start h-5">
        <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
      </span>
    </span>
  )
}
