"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Badge } from './badge';
import { ChevronDown } from 'lucide-react';
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
  SimpleMarkdownRenderer?: React.ComponentType<{ content: string }>;
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
  SimpleMarkdownRenderer = RichMarkdownRenderer,
}: ReleaseChangelogSectionProps) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // Reset preview-expanded state when the entries set changes — otherwise
  // a parent that refetches and shrinks entries from N → 1 would leave
  // the user with a stale "expanded" state and a momentarily-wrong
  // "Show 0 more" button before the `previewNeedsFade` gate hides it.
  // Keyed on `entries.length` (not identity) so re-renders with the same
  // length don't churn state unnecessarily.
  useEffect(() => {
    setPreviewExpanded(false);
  }, [entries.length]);

  if (!entries || entries.length === 0) return null;

  // collapsible wins when both flags are passed (documented in JSDoc).
  const inPreviewMode = previewFirst && !collapsible;
  const previewNeedsFade = inPreviewMode && entries.length > 1;
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
            <h2 className={`flex items-center gap-2 text-2xl font-bold ${isBreaking ? 'text-red-500' : 'text-ods-text-primary'}`}>
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
          <h2 className={`flex items-center gap-2 text-2xl font-bold ${isBreaking ? 'text-red-500' : 'text-ods-text-primary'}`}>
            {icon}
            {title}
            <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
          </h2>
        )
      )}
      {showEntries && (
        inPreviewMode ? (
          /* Preview-first mode: render the list in a height-clamped +
             mask-faded wrapper. The CSS mask creates the soft fade-out
             at the bottom of the collapsed region; the inline maxHeight
             + transition animate the open/close. When `previewExpanded`
             flips, the wrapper falls back to its natural scrollHeight
             (or 2000px on first render before the ref measures). */
          <div className="relative">
            <div
              ref={previewContentRef}
              className="overflow-hidden transition-[max-height] duration-500"
              style={{
                transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
                maxHeight: previewExpanded || !previewNeedsFade
                  ? previewContentRef.current?.scrollHeight ?? 2000
                  : PREVIEW_COLLAPSED_HEIGHT,
                ...(previewNeedsFade && !previewExpanded ? {
                  maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
                } : {}),
              }}
            >
              <ChangelogEntryList entries={entries} SimpleMarkdownRenderer={SimpleMarkdownRenderer} />
            </div>
            {previewNeedsFade && (
              <button
                type="button"
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="mt-4 flex items-center gap-1.5 text-sm text-ods-text-secondary hover:text-ods-accent transition-colors duration-200"
              >
                <span>{previewExpanded ? 'Show less' : `Show ${entries.length - 1} more`}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${previewExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
        ) : (
          <ChangelogEntryList entries={entries} SimpleMarkdownRenderer={SimpleMarkdownRenderer} />
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
  SimpleMarkdownRenderer,
}: {
  entries: ChangelogEntry[];
  SimpleMarkdownRenderer: React.ComponentType<{ content: string }>;
}) {
  return (
    <ul className="space-y-6">
      {entries.map((entry, index) => (
        <li key={index} className="border-l-2 border-ods-border pl-4 ml-0">
          {/* Entry title — `text-h3` is body family + BOLD weight (per
              ODS tokens: `--font-h3-weight: var(--font-weight-bold)`)
              at 14/18px responsive. Same body size as the description
              below, distinguished by weight — clean visual hierarchy
              without inflating the body scale. */}
          <p className="text-h3 text-ods-text-primary mb-2">{entry.title}</p>
          {entry.description && (
            /* Entry description — body text matches the main release
               summary at the SAME 14/18px responsive `text-h4` scale.
               The `SimpleMarkdownRenderer` forces its own `<p>` typography
               which would override `text-h4` on `lg+` viewports and
               inflate the changelog body to 20px. The `[&_p]:!` overrides
               pin every descendant `<p>` back to the h4 responsive tokens
               so the breakpoints stay aligned with the rest of the page. */
            <div className="text-h4 text-ods-text-primary [&_p]:!text-[length:var(--font-size-h4-body)] [&_p]:!leading-[var(--font-line-space-h4-body)] [&_p]:!font-medium">
              <SimpleMarkdownRenderer content={entry.description} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
