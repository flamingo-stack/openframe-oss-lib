"use client"

import React, { useState } from 'react';
import { Badge } from './badge';
import { ChevronDown } from 'lucide-react';
import { FadePreview } from './fade-preview';
import { RichMarkdownRenderer } from './rich-markdown-renderer';
import type { ChangelogEntry } from '../../types/product-release';

interface ReleaseChangelogSectionProps {
  title: string;
  entries: ChangelogEntry[];
  isBreaking?: boolean;
  hideTitle?: boolean;
  /** When true, section starts collapsed and can be toggled open/closed
   *  via a button on the title row. Mutually exclusive with `previewFirst`. */
  collapsible?: boolean;
  /** Initial collapsed state (only used when collapsible=true). Defaults to true (collapsed). */
  defaultCollapsed?: boolean;
  /** When true, render the first entry in full and fade-mask the rest
   *  with a "Show N more / Show less" toggle below the list. Hides the
   *  fade + toggle when there's only one entry. Mutually exclusive with
   *  `collapsible` — when both are passed, `collapsible` wins.
   *
   *  This is the same progressive-disclosure pattern used on the
   *  investor-update detail page's Key Highlights / Financial Notes
   *  sections (formerly a duplicated `FadedHighlightSection` component
   *  in the hub — unified here). */
  previewFirst?: boolean;
  /** Optional lucide icon rendered inline before the title text. Matches the
   *  catalog card's changelog-strip icons (Sparkles for Features, Wrench for
   *  Fixes, TrendingUp for Improvements, AlertTriangle for Breaking) — same
   *  visual taxonomy across catalog and detail. Inherits the title's color
   *  (secondary for normal sections, red for breaking). */
  icon?: React.ReactNode;
  /** Markdown renderer for each entry's description. Optional — defaults to
   *  the lib's `RichMarkdownRenderer` so changelog rich-link previews
   *  (YouTube, OG cards, etc.) work out of the box. Hosts that already
   *  wrap with a Supabase-aware preset can keep passing their own. */
  MarkdownRenderer?: React.ComponentType<{ content: string }>;
}

// Collapsed height for the preview-first mode. ~120px shows the first
// entry's title + the start of its description before the mask kicks in.
const PREVIEW_COLLAPSED_HEIGHT = 120;

export function ReleaseChangelogSection({
  title,
  entries,
  isBreaking = false,
  hideTitle = false,
  collapsible = false,
  defaultCollapsed = true,
  previewFirst = false,
  icon,
  MarkdownRenderer = RichMarkdownRenderer,
}: ReleaseChangelogSectionProps) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);

  if (!entries || entries.length === 0) return null;

  // collapsible wins when both flags are passed (documented in JSDoc).
  const inPreviewMode = previewFirst && !collapsible;
  const showEntries = !collapsible || !collapsed;

  return (
    <div className="space-y-4">
      {!hideTitle && (
        collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-between w-full cursor-pointer"
          >
            <h2 className={`flex items-center gap-2 text-h2 ${isBreaking ? 'text-ods-error' : 'text-ods-text-primary'}`}>
              {icon}
              {title}
              <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
            </h2>
            <ChevronDown
              className={`h-4 w-4 text-ods-text-secondary shrink-0 transition-transform duration-200 ${
                !collapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : (
          <h2 className={`flex items-center gap-2 text-h2 ${isBreaking ? 'text-ods-error' : 'text-ods-text-primary'}`}>
            {icon}
            {title}
            <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
          </h2>
        )
      )}
      {showEntries && (
        inPreviewMode ? (
          /* Preview-first mode: the shared `FadePreview` primitive clamps
             the list to ~one full entry, fade-masks the rest, and renders
             the "Show N more / Show less" toggle. */
          <FadePreview
            hiddenCount={entries.length - 1}
            collapsedHeight={PREVIEW_COLLAPSED_HEIGHT}
            resetKey={entries.length}
          >
            <ChangelogEntryList entries={entries} MarkdownRenderer={MarkdownRenderer} />
          </FadePreview>
        ) : (
          <ChangelogEntryList entries={entries} MarkdownRenderer={MarkdownRenderer} />
        )
      )}
    </div>
  );
}

/**
 * Internal list renderer — shared by the default and preview-first
 * branches. Each entry is a bordered-left list item with bold title
 * + markdown-rendered description body.
 */
function ChangelogEntryList({
  entries,
  MarkdownRenderer,
}: {
  entries: ChangelogEntry[];
  MarkdownRenderer: React.ComponentType<{ content: string }>;
}) {
  return (
    <ul className="space-y-6">
      {entries.map((entry, index) => (
        <li key={index} className="border-l-2 border-ods-border pl-4 ml-0">
          {/* Entry title — run through the SAME markdown renderer as the
              description so inline markdown (links like `[label](url)`,
              emphasis) renders instead of showing as raw text, then pinned
              back to the `text-h3` body+BOLD scale (per ODS tokens:
              `--font-h3-weight: var(--font-weight-bold)`, 14/18px responsive)
              so plain-text titles look exactly as before. `[&_p]:!my-0`
              strips the renderer's paragraph margins; `mb-2` keeps the gap to
              the description. */}
          <div className="text-h3 text-ods-text-primary mb-2 [&_p]:!text-[length:var(--font-size-h3-body)] [&_p]:!leading-[var(--font-line-space-h3-body)] [&_p]:!font-bold [&_p]:!my-0 [&_p+p]:!mt-2">
            <MarkdownRenderer content={entry.title} />
          </div>
          {entry.description && (
            /* Entry description — body text matches the main release
               summary at the SAME 14/18px responsive `text-h4` scale.
               The `MarkdownRenderer` forces its own `<p>` typography
               which would override `text-h4` on `lg+` viewports and
               inflate the changelog body to 20px. The `[&_p]:!` overrides
               pin every descendant `<p>` back to the h4 responsive tokens
               so the breakpoints stay aligned with the rest of the page. */
            <div className="text-h4 text-ods-text-primary [&_p]:!text-[length:var(--font-size-h4-body)] [&_p]:!leading-[var(--font-line-space-h4-body)] [&_p]:!font-medium">
              <MarkdownRenderer content={entry.description} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
