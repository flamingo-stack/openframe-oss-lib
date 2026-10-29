/**
 * Single source of truth for "what does clicking THIS row do?" across
 * the chat-adjacent surfaces (source chips, inline cards, search results).
 *
 * Lib-side refactor of the hub's `lib/utils/source-row-cta.ts`. Drops:
 *   - `traceCompose()` logging   — lib stays log-free; hosts can wrap
 *   - `tableIdForDocumentType`   — host injects via `ctx.tableIdForDocumentType`
 *
 * The contract:
 *   - `icon` + `iconLabel` — for visual + a11y. Sourced from
 *     `SOURCE_ICON_NAMES` keyed by the row's `sourceRepo` (config id),
 *     resolved to a React component via `ICON_REGISTRY`.
 *   - `href` — destination URL, from the host's composer (`composeContentUrl`). `null` means "no viewer; Ask is
 *     the only action". Runs `safeHref()` on the final value so a hostile RAG row can't land `javascript:` /
 *     `data:` in the DOM.
 *   - `askable` — whether the Ask drill-in flow can fire. Requires a
 *     non-empty `id` AND a `documentType`.
 *   - `chatRef` — pre-synthesized `ChatRef` for the Ask handler.
 */

import { FileText } from 'lucide-react';
import type React from 'react';
import type { ComposeContentUrl } from '../../../utils/content-href';
import { canonicalContentRefType } from '../../../utils/list-url';
import { DOC_TABLE_TYPES } from '../../../utils/source-grouping';
import { getSourceIconName } from '../../../utils/source-icons';
import type { ChatRef } from '../chat-ref.types';
import { safeHref } from './compact-card-classes';
import { resolveIcon } from './icon-library';

/** Path sanitization — keep alphanumerics, slash, dash, dot, underscore;
 *  strip everything else. Defends against a hostile mapper returning a
 *  path with `..` traversal or query-string injection. */
function sanitizePath(path: string): string {
  return (path || '').replace(/[^a-zA-Z0-9/_\-.]/g, '');
}

export interface SourceRowInput {
  /** RagTableConfig.id (e.g. 'blog-posts', 'financial-cap-table'). Drives
   *  icon resolution via `SOURCE_ICON_NAMES` + `ICON_REGISTRY`. */
  sourceRepo?: string | null;
  /** The config's `documentType` (e.g. 'blog_post', 'cap_table'). Drives
   *  the Ask drill-in's `ChatRef.type`. */
  documentType?: string | null;
  /** Primary-key value of the row (config.primaryKey). Required for Ask. */
  id?: string | null;
  /** Display title. */
  title: string;
  /** Resolved public URL when the row HAS a viewer. `null`/undefined when
   *  the row has no public destination — surface decides Ask-only behavior. */
  externalUrl?: string | null;
  /** Platform that owns `externalUrl`. */
  targetPlatform?: string | null;
  /** In-app navigator path (e.g. `legal/fundraising/.../safe`). */
  path?: string | null;
}

export interface SourceRowContext {
  /**
   * Host-supplied reverse map: documentType → tableId. Used to derive
   * `sourceRepo` from `documentType` when the caller didn't supply it
   * (inline cards know `ref.type` but not `sourceRepo`). When omitted,
   * the resolver falls back to the documentType reverse-map miss and
   * keeps the FileText icon.
   */
  tableIdForDocumentType?: (documentType: string) => string | null;
  /**
   * The host's ONE address rule (`runtime.composeContentUrl`). Every row resolves its href through it: a record by
   * its `externalUrl`, a doc by its tree `path` (passed as the `slug`). The host decides where each type lives and
   * whether that is this site or another platform; the lib builds no address of its own. With no composer, a
   * record's `externalUrl` is used as given and a doc has no link.
   */
  composeContentUrl?: ComposeContentUrl;
}

export interface SourceRowCTA {
  /** Source icon component. Always defined — falls back to `FileText`. */
  icon: React.ComponentType<{ className?: string }>;
  /** Human-readable label for the icon. */
  iconLabel: string;
  /** Resolved destination URL. `null` when the row has no openable
   *  target. Already passed through `safeHref()`. */
  href: string | null;
  /** Platform that owns the destination. `null` when the row has no
   *  openable target OR the destination is external/unknown. */
  targetPlatform: string | null;
  /** When true, the surface can fire the Ask drill-in flow for this row. */
  askable: boolean;
  /** Pre-synthesized `ChatRef` for the Ask handler. `null` when not askable. */
  chatRef: ChatRef | null;
}

/**
 * Build a `SourceRowContext` from a `ChatRuntime`. Wired identically at every `resolveSourceRowCTA` call site
 * (source chips + inline cards), so it lives here once.
 */
export function sourceRowCtxFromRuntime(runtime: { composeContentUrl?: ComposeContentUrl }): SourceRowContext {
  return { composeContentUrl: runtime.composeContentUrl };
}

/**
 * Pure icon-resolution helper — `sourceRepo` (RagTableConfig.id) →
 * icon_name via `SOURCE_ICON_NAMES`, then icon_name → React component
 * via `resolveIcon` (the brand set, else the design set).
 */
function pickSourceIcon(sourceRepo: string | null, documentType: string | null | undefined) {
  const iconName = sourceRepo ? getSourceIconName(sourceRepo) : undefined;
  const icon = iconName ? resolveIcon(iconName, { variant: 'brand' }) : FileText;
  const iconLabel = documentType ?? 'Source';
  return { icon, iconLabel };
}

/** A doc-table row (DOC_TABLE_TYPES) is addressed by its tree `path`; every other row by its `externalUrl`. */
function isDocRow(row: SourceRowInput): boolean {
  return !!row.documentType && (DOC_TABLE_TYPES as readonly string[]).includes(row.documentType);
}

/**
 * Resolve the CTA contract for a row. Pure function — no DOM, no fetch,
 * no logging. Call from any surface (chip, card, search result) with the
 * same row shape and get the same answer back.
 */
export function resolveSourceRowCTA(row: SourceRowInput, ctx: SourceRowContext = {}): SourceRowCTA {
  // Derive sourceRepo from documentType when the caller didn't supply
  // it. Inline cards know `ref.type` (documentType) but not `sourceRepo`;
  // chips and search results have sourceRepo directly. The host supplies
  // the reverse map via `ctx.tableIdForDocumentType`.
  const sourceRepo =
    row.sourceRepo ??
    (row.documentType && ctx.tableIdForDocumentType ? ctx.tableIdForDocumentType(row.documentType) : null) ??
    null;

  const { icon, iconLabel } = pickSourceIcon(sourceRepo, row.documentType);

  // URL resolution. `idValue` (row primary key) is shared with the Ask
  // drill-in check below.
  let href: string | null = null;
  let targetPlatform: string | null = null;
  const idValue = (row.id ?? '').trim();
  // ONE address rule, the host's (`composeContentUrl`): a record by its `externalUrl`, a doc by its tree `path`
  // (passed as the `slug`). The host's composer decides where the type lives and whether that is this site (a
  // relative link) or another platform; the lib builds no address of its own (CU-17tkuw61kfy).
  const docPath = !row.externalUrl && row.path && isDocRow(row) ? sanitizePath(row.path) : '';
  if (ctx.composeContentUrl && row.documentType && (row.externalUrl || docPath)) {
    const composed = ctx.composeContentUrl({
      // Canonical vocabulary only — a rail-vocab alias would miss the host's
      // `hostedTypes` / `overrides` and fall through to the seam's default
      // `<origin>/<type>/<id>` branch. Same canonicalizer `buildListUrl` uses.
      type: canonicalContentRefType(row.documentType),
      identifier: idValue,
      ...(docPath ? { slug: docPath } : {}),
      externalUrl: row.externalUrl ?? null,
      targetPlatform: row.targetPlatform ?? null,
    });
    href = composed.href ? (safeHref(composed.href) ?? null) : null;
    targetPlatform = composed.targetPlatform;
  } else if (row.externalUrl) {
    // No composer wired: the record's own address, as given.
    href = safeHref(row.externalUrl) ?? null;
    targetPlatform = row.targetPlatform ?? null;
  }

  // Ask drill-in viability. (`idValue` computed above.) `documentType` is read
  // into a local so the ternary below branches on the VALUE — a `!!(...)`
  // boolean flag proves nothing to the compiler about `row.documentType`.
  const documentType = row.documentType;
  const askable = !!(idValue && documentType);
  const chatRef: ChatRef | null =
    idValue && documentType
      ? {
          type: documentType,
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
        }
      : null;

  return { icon, iconLabel, href, targetPlatform, askable, chatRef };
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
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
} {
  if (!input) return { Icon: FileText, label: 'Source' };
  const { sourceRepo, documentType } = typeof input === 'string' ? { sourceRepo: null, documentType: input } : input;
  if (!sourceRepo && !documentType) return { Icon: FileText, label: 'Source' };
  const resolvedRepo =
    sourceRepo ??
    (documentType && ctx.tableIdForDocumentType ? ctx.tableIdForDocumentType(documentType) : null) ??
    null;
  const { icon, iconLabel } = pickSourceIcon(resolvedRepo, documentType);
  return { Icon: icon, label: iconLabel };
}
