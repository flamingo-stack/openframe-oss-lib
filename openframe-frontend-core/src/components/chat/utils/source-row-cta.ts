/**
 * Single source of truth for "what does clicking THIS row do?" across
 * the chat-adjacent surfaces (source chips, inline cards, search results).
 *
 * Lib-side refactor of the hub's `lib/utils/source-row-cta.ts`. Drops:
 *   - `currentPlatform()`        — host injects via `ctx.currentPlatform`
 *   - `traceCompose()` logging   — lib stays log-free; hosts can wrap
 *   - `tableIdForDocumentType`   — host injects via `ctx.tableIdForDocumentType`
 *
 * The contract:
 *   - `icon` + `iconLabel` — for visual + a11y. Sourced from
 *     `SOURCE_ICON_NAMES` keyed by the row's `sourceRepo` (config id),
 *     resolved to a React component via `ICON_REGISTRY`.
 *   - `href` — destination URL. `null` means "no public viewer; Ask is
 *     the only action". Honors the inline card / chip / search bar's
 *     existing fallback chain (externalUrl → in-app path → null) and
 *     also runs `safeHref()` on the final value so a hostile RAG row
 *     can't land `javascript:` / `data:` in the DOM.
 *   - `askable` — whether the Ask drill-in flow can fire. Requires a
 *     non-empty `id` AND a `documentType`.
 *   - `chatRef` — pre-synthesized `ChatRef` for the Ask handler.
 */

import React from 'react'
import { FileText } from 'lucide-react'
import { getSourceIconName } from './source-icons'
import { getIconComponent } from './icon-registry'
import { getBaseUrl } from '../../../utils/cn'
import { safeHref } from './compact-card-classes'
import type { ChatRef } from '../chat-ref.types'
import type { ComposeContentUrl } from '../../../utils/content-href'

/** Path sanitization — keep alphanumerics, slash, dash, dot, underscore;
 *  strip everything else. Defends against a hostile mapper returning a
 *  path with `..` traversal or query-string injection. */
function sanitizePath(path: string): string {
  return (path || '').replace(/[^a-zA-Z0-9/_\-.]/g, '')
}

export interface SourceRowInput {
  /** RagTableConfig.id (e.g. 'blog-posts', 'financial-cap-table'). Drives
   *  icon resolution via `SOURCE_ICON_NAMES` + `ICON_REGISTRY`. */
  sourceRepo?: string | null
  /** The config's `documentType` (e.g. 'blog_post', 'cap_table'). Drives
   *  the Ask drill-in's `ChatRef.type`. */
  documentType?: string | null
  /** Primary-key value of the row (config.primaryKey). Required for Ask. */
  id?: string | null
  /** Display title. */
  title: string
  /** Resolved public URL when the row HAS a viewer. `null`/undefined when
   *  the row has no public destination — surface decides Ask-only behavior. */
  externalUrl?: string | null
  /** Platform that owns `externalUrl`. */
  targetPlatform?: string | null
  /** In-app navigator path (e.g. `legal/fundraising/.../safe`). */
  path?: string | null
}

export interface SourceRowContext {
  /** Chat shell's base route — `/data-room`, `/knowledge-base`, etc. */
  baseRoute?: string
  /** Cross-platform target for the chip / card click. */
  chipBasePlatform?: string
  /**
   * Host-supplied current-platform identifier. Used as the
   * `targetPlatform` for path-based fallback URLs that point to the
   * host's own surface. When omitted, path-based fallback rows get a
   * `null` targetPlatform — consumers fall back to their legacy
   * origin-check.
   */
  currentPlatform?: string | null
  /**
   * Host-supplied reverse map: documentType → tableId. Used to derive
   * `sourceRepo` from `documentType` when the caller didn't supply it
   * (inline cards know `ref.type` but not `sourceRepo`). When omitted,
   * the resolver falls back to the documentType reverse-map miss and
   * keeps the FileText icon.
   */
  tableIdForDocumentType?: (documentType: string) => string | null
  /**
   * Host-supplied unified content-href resolver (`runtime.composeContentUrl`).
   * When provided, entity rows WITH a public `externalUrl` resolve their href
   * through it — so the host's `hostedTypes` / `overrides` route a chat card to
   * the SAME destination as the equivalent page-view card (in-app for hosted
   * types, the hub URL otherwise). When omitted, the row's `externalUrl` is used
   * verbatim (legacy).
   */
  composeContentUrl?: ComposeContentUrl
  /**
   * Host-supplied per-`documentType` doc-viewer targets — the UNIFIED, DYNAMIC
   * replacement for the single `chipBasePlatform`. Maps a doc-table documentType
   * (`'markdown'`, `'data_room_doc'`, …) → the platform whose PUBLIC doc viewer
   * hosts it + that viewer's base path. A doc chip with no `externalUrl` resolves
   * to `getBaseUrl(platform)/<basePath>/<path>` PER ROW — so a chat mixing several
   * doc sources sends EACH to its own home (markdown→flamingo/knowledge-base,
   * data_room_doc→company-hub/data-room) instead of one static fallback for all.
   * Wins over `chipBasePlatform` when a row's documentType has an entry.
   */
  docPlatformTargets?: Record<string, { platform: string; basePath: string }>
}

export interface SourceRowCTA {
  /** Source icon component. Always defined — falls back to `FileText`. */
  icon: React.ComponentType<{ className?: string }>
  /** Human-readable label for the icon. */
  iconLabel: string
  /** Resolved destination URL. `null` when the row has no openable
   *  target. Already passed through `safeHref()`. */
  href: string | null
  /** Platform that owns the destination. `null` when the row has no
   *  openable target OR the destination is external/unknown. */
  targetPlatform: string | null
  /** When true, the surface can fire the Ask drill-in flow for this row. */
  askable: boolean
  /** Pre-synthesized `ChatRef` for the Ask handler. `null` when not askable. */
  chatRef: ChatRef | null
}

/**
 * Build a `SourceRowContext` from a `ChatRuntime` + the surface's `baseRoute` /
 * `chipBasePlatform`. The runtime-derived fields (`currentPlatform`, `composeContentUrl`,
 * `docPlatformTargets`) are wired identically at every `resolveSourceRowCTA` call site
 * (source chips + inline cards), so they live here once — adding a ctx field is then a
 * one-line change instead of editing all three call sites.
 */
export function sourceRowCtxFromRuntime(
  runtime: {
    source?: string
    composeContentUrl?: ComposeContentUrl
    docPlatformTargets?: SourceRowContext['docPlatformTargets']
  },
  surface: { baseRoute?: string; chipBasePlatform?: string } = {},
): SourceRowContext {
  return {
    currentPlatform: runtime.source ?? null,
    composeContentUrl: runtime.composeContentUrl,
    docPlatformTargets: runtime.docPlatformTargets,
    baseRoute: surface.baseRoute,
    chipBasePlatform: surface.chipBasePlatform,
  }
}

/**
 * Pure icon-resolution helper — `sourceRepo` (RagTableConfig.id) →
 * icon_name via `SOURCE_ICON_NAMES`, then icon_name → React component
 * via `ICON_REGISTRY`.
 */
function pickSourceIcon(sourceRepo: string | null, documentType: string | null | undefined) {
  const iconName = sourceRepo ? getSourceIconName(sourceRepo) : undefined
  const icon = iconName ? getIconComponent(iconName) : FileText
  const iconLabel = documentType ?? 'Source'
  return { icon, iconLabel }
}

/**
 * Doc-table documentTypes — rows that carry an in-app `path` (not an entity
 * `externalUrl`) and resolve to a doc viewer. The SAME set an embedder keys its
 * `docPlatformTargets` map by (markdown = product docs, data_room_doc = data room),
 * declared once so the two can't silently diverge.
 */
export const DOC_TABLE_TYPES = ['markdown', 'data_room_doc'] as const

/**
 * Only doc-table rows (DOC_TABLE_TYPES) fall back to doc-viewer navigation when no
 * `externalUrl` is set; the in-app/per-platform viewer can render them. Entity-table
 * rows MUST come with an explicit `externalUrl` from the mapper.
 */
function shouldFallbackToPathNav(row: SourceRowInput): boolean {
  return !!row.documentType && (DOC_TABLE_TYPES as readonly string[]).includes(row.documentType)
}

/**
 * Resolve the CTA contract for a row. Pure function — no DOM, no fetch,
 * no logging. Call from any surface (chip, card, search result) with the
 * same row shape and get the same answer back.
 */
export function resolveSourceRowCTA(
  row: SourceRowInput,
  ctx: SourceRowContext = {},
): SourceRowCTA {
  // Derive sourceRepo from documentType when the caller didn't supply
  // it. Inline cards know `ref.type` (documentType) but not `sourceRepo`;
  // chips and search results have sourceRepo directly. The host supplies
  // the reverse map via `ctx.tableIdForDocumentType`.
  const sourceRepo = row.sourceRepo
    ?? (row.documentType && ctx.tableIdForDocumentType ? ctx.tableIdForDocumentType(row.documentType) : null)
    ?? null

  const { icon, iconLabel } = pickSourceIcon(sourceRepo, row.documentType)

  // URL resolution. `idValue` (row primary key) is shared with the Ask
  // drill-in check below.
  let href: string | null = null
  let targetPlatform: string | null = null
  const idValue = (row.id ?? '').trim()
  if (row.path && shouldFallbackToPathNav(row) && !row.externalUrl) {
    // Doc-table (markdown / data-room PDF) with no public URL. Resolve where its
    // viewer lives, in priority order (NOT a content type the composeContentUrl
    // seam knows — docs carry a tree `path`, not a slug/id):
    //   1. docPlatformTargets[documentType] — per-doc-type cross-platform target.
    //      The UNIFIED, DYNAMIC path: a chat mixing multiple doc sources routes
    //      EACH row to its own home (markdown→flamingo, data_room_doc→company-hub).
    //   2. chipBasePlatform — legacy SINGLE cross-platform fallback (one platform
    //      for every doc; only safe when a surface sees just one doc source).
    //   3. baseRoute — the host serves the doc viewer in-app → relative path nav.
    //   else → null (no viewer configured → Ask-only).
    const safePath = sanitizePath(row.path)
    if (safePath) {
      const docTarget = row.documentType ? ctx.docPlatformTargets?.[row.documentType] : undefined
      if (docTarget) {
        // Trim leading/trailing (and collapse empty) segments WITHOUT a regex — the
        // slash-stripping regex `/^\/+|\/+$/g` tripped CodeQL's js/polynomial-redos (high)
        // since `\/+$` backtracks on inputs with many '/'. split/filter/join is linear.
        const seg = docTarget.basePath.split('/').filter(Boolean).join('/')
        const base = `${getBaseUrl(docTarget.platform)}${seg ? `/${seg}` : ''}/`
        href = safeHref(new URL(safePath, base).toString()) ?? null
        targetPlatform = docTarget.platform
      } else if (ctx.chipBasePlatform) {
        const base = `${getBaseUrl(ctx.chipBasePlatform)}/knowledge-base/`
        href = safeHref(new URL(safePath, base).toString()) ?? null
        targetPlatform = ctx.chipBasePlatform
      } else if (ctx.baseRoute) {
        const synthetic = `https://_internal_.local${ctx.baseRoute.startsWith('/') ? ctx.baseRoute : '/' + ctx.baseRoute}/`
        const absolute = new URL(safePath, synthetic).toString()
        href = safeHref(absolute.replace('https://_internal_.local', '')) ?? null
        targetPlatform = ctx.currentPlatform ?? null
      }
    }
  } else if (ctx.composeContentUrl && row.documentType && row.externalUrl) {
    // Entity content WITH a public viewer → the unified content-href seam. The
    // host's hostedTypes/overrides route hosted types in-app (slug relativized
    // from the externalUrl) and everything else to the externalUrl verbatim —
    // the SAME resolver the page-view cards use, so chat + page links match.
    const composed = ctx.composeContentUrl({
      type: row.documentType,
      identifier: idValue,
      externalUrl: row.externalUrl,
      targetPlatform: row.targetPlatform ?? null,
    })
    href = composed.href ? (safeHref(composed.href) ?? null) : null
    targetPlatform = composed.targetPlatform
  } else if (row.externalUrl) {
    // No composer wired → legacy: the RAG externalUrl verbatim.
    href = safeHref(row.externalUrl) ?? null
    targetPlatform = row.targetPlatform ?? null
  }

  // Ask drill-in viability. (`idValue` computed above.)
  const askable = !!(idValue && row.documentType)
  const chatRef: ChatRef | null = askable
    ? ({
        type: row.documentType!,
        ...(sourceRepo ? { sourceRepo } : {}),
        id: idValue,
        title: row.title,
        url: href,
        targetPlatform,
        // Carry `path` so a downstream inline card (rendered from this
        // chatRef on a subsequent turn) gets the same doc-tree-swap
        // routing the chip already used. Without it, the Ask drill-in
        // would resolve to a same-tab full-page nav even when an in-app
        // path is available.
        ...(row.path ? { metadata: { path: row.path } } : {}),
      } as ChatRef)
    : null

  return { icon, iconLabel, href, targetPlatform, askable, chatRef }
}

/**
 * Convenience helper for callers that just need the source icon —
 * inline cards' tracking strip + the search-bar dropdown row, today.
 *
 * Single source of truth: every consumer (chips, search results,
 * inline cards) routes through `SOURCE_ICON_NAMES` + `ICON_REGISTRY`.
 *
 * Accepts a string for backward-compatibility with the single-arg call
 * shape — treated as `documentType`.
 */
export function resolveSourceIcon(
  input: { sourceRepo?: string | null; documentType?: string | null } | string | null | undefined,
  ctx: { tableIdForDocumentType?: (documentType: string) => string | null } = {},
): {
  Icon: React.ComponentType<{ className?: string }>
  label: string
} {
  if (!input) return { Icon: FileText, label: 'Source' }
  const { sourceRepo, documentType } = typeof input === 'string'
    ? { sourceRepo: null, documentType: input }
    : input
  if (!sourceRepo && !documentType) return { Icon: FileText, label: 'Source' }
  const resolvedRepo = sourceRepo
    ?? (documentType && ctx.tableIdForDocumentType ? ctx.tableIdForDocumentType(documentType) : null)
    ?? null
  const { icon, iconLabel } = pickSourceIcon(resolvedRepo, documentType)
  return { Icon: icon, label: iconLabel }
}
