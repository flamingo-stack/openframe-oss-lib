'use client';

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { ChangelogEntry } from '../../types/product-release';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { Badge, BadgeSkeleton } from './badge';
import { Button } from './button';
import { FadePreview } from './fade-preview';
import { LoadingItems, useLoadingScope } from './loading-scope';
import { RichMarkdownRenderer } from './markdown';

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
  /** Mark the loaded section `data-loading-optional`: a block its page's loading state does not draw. */
  loadingOptional?: boolean;
}

// Collapsed height for the preview-first mode. ~120px shows the first
// entry's title + the start of its description before the mask kicks in.
const PREVIEW_COLLAPSED_HEIGHT = 120;

/** The section's layout, read by the section and by its skeleton, so the skeleton is the section's size. */
const SECTION_CLASS = 'space-y-4';
const COLLAPSIBLE_TITLE_ROW_CLASS = 'flex w-full cursor-pointer items-center justify-between';
/**
 * The collapsible title row as a `glyph` `Button` (no surface, no box of its own: `size="wrap"`): it lets the
 * heading wrap, and restates the heading icon's 24px, because a Button sizes every svg inside it.
 */
const COLLAPSIBLE_TITLE_BUTTON_CLASS = cn(
  COLLAPSIBLE_TITLE_ROW_CLASS,
  'whitespace-normal text-left [&_svg]:h-6 [&_svg]:w-6',
);
const TITLE_BASE_CLASS = 'flex items-center gap-2 text-h2';
const titleClass = (isBreaking: boolean) =>
  `${TITLE_BASE_CLASS} ${isBreaking ? 'text-ods-error' : 'text-ods-text-primary'}`;
const COUNT_BADGE_CLASS = 'ml-2';
/** 16px, kept against the title Button's svg size (`!`). */
const CHEVRON_CLASS = '!h-4 !w-4 shrink-0 text-ods-text-secondary transition-transform duration-200';
const ENTRY_LIST_CLASS = 'space-y-6';
const ENTRY_CLASS = 'ml-0 border-l-2 border-ods-border pl-4';
const ENTRY_TITLE_CLASS =
  'mb-2 text-ods-text-primary text-h3 [&_p+p]:!mt-2 [&_p]:!my-0 [&_p]:!text-[length:var(--font-size-h3-body)] [&_p]:!font-bold [&_p]:!leading-[var(--font-line-space-h3-body)]';
const ENTRY_DESCRIPTION_CLASS =
  'text-ods-text-primary text-h4 [&_p]:!text-[length:var(--font-size-h4-body)] [&_p]:!font-medium [&_p]:!leading-[var(--font-line-space-h4-body)]';
/** FadePreview's toggle row: a `size="compact"` link Button (h-6, at every width) under a `mf` gap. */
const COMPACT_BUTTON_HEIGHT_CLASS = 'h-6';
const PREVIEW_TOGGLE_SKELETON_CLASS = cn('mt-[var(--spacing-system-mf)] w-28', COMPACT_BUTTON_HEIGHT_CLASS);
/** Entries a skeleton draws: a section's entries are the data's (no page size), so a typical one, which is also all
 *  the preview-first mode shows before its fade (the preview is the section's first entry). */
const CHANGELOG_SKELETON_ENTRIES = 1;

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
  loadingOptional = false,
}: ReleaseChangelogSectionProps) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);
  const loading = useLoadingScope();

  if (loading)
    return (
      <ReleaseChangelogSectionSkeleton
        title={title}
        isBreaking={isBreaking}
        hideTitle={hideTitle}
        collapsible={collapsible}
        defaultCollapsed={defaultCollapsed}
        previewFirst={previewFirst}
        icon={icon}
      />
    );

  if (!entries || entries.length === 0) return null;

  // collapsible wins when both flags are passed (documented in JSDoc).
  const inPreviewMode = previewFirst && !collapsible;
  const showEntries = !collapsible || !collapsed;

  return (
    <div className={SECTION_CLASS} data-loading-optional={loadingOptional || undefined}>
      {!hideTitle &&
        (collapsible ? (
          <Button
            type="button"
            variant="glyph"
            size="wrap"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            className={COLLAPSIBLE_TITLE_BUTTON_CLASS}
          >
            <h2 className={titleClass(isBreaking)}>
              {icon}
              {title}
              <Badge variant="secondary" className={COUNT_BADGE_CLASS}>
                {entries.length}
              </Badge>
            </h2>
            <ChevronDown className={`${CHEVRON_CLASS} ${!collapsed ? 'rotate-180' : ''}`} />
          </Button>
        ) : (
          <h2 className={titleClass(isBreaking)}>
            {icon}
            {title}
            <Badge variant="secondary" className={COUNT_BADGE_CLASS}>
              {entries.length}
            </Badge>
          </h2>
        ))}
      {showEntries &&
        (inPreviewMode ? (
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
        ))}
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
    <ul className={ENTRY_LIST_CLASS}>
      {entries.map((entry, index) => (
        <li key={index} className={ENTRY_CLASS} data-loading-item>
          {/* Entry title — run through the SAME markdown renderer as the
              description so inline markdown (links like `[label](url)`,
              emphasis) renders instead of showing as raw text, then pinned
              back to the `text-h3` body+BOLD scale (per ODS tokens:
              `--font-h3-weight: var(--font-weight-bold)`, 14/18px responsive)
              so plain-text titles look exactly as before. `[&_p]:!my-0`
              strips the renderer's paragraph margins; `mb-2` keeps the gap to
              the description. */}
          <div className={ENTRY_TITLE_CLASS}>
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
            <div className={ENTRY_DESCRIPTION_CLASS}>
              <MarkdownRenderer content={entry.description} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface ReleaseChangelogSectionSkeletonProps {
  /** The section's heading (static copy: drawn for real). */
  title: string;
  isBreaking?: boolean;
  hideTitle?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** The preview-first mode: the first entry clamped to the preview height, then the toggle row. */
  previewFirst?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * A changelog section while it is read: the real icon and heading, the count badge as a chip, the first entry (title
 * line and description lines) as bars, clamped to the preview height with FadePreview's toggle row in preview mode.
 */
export function ReleaseChangelogSectionSkeleton({
  title,
  isBreaking = false,
  hideTitle = false,
  collapsible = false,
  defaultCollapsed = true,
  previewFirst = false,
  icon,
  className,
}: ReleaseChangelogSectionSkeletonProps) {
  const heading = (
    <h2 className={titleClass(isBreaking)}>
      {icon}
      {title}
      {/* The count badge's own frame; its text is one or two digits. */}
      <BadgeSkeleton className={cn(COUNT_BADGE_CLASS, 'w-[2ch]')} />
    </h2>
  );
  const inPreviewMode = previewFirst && !collapsible;
  const showEntries = !collapsible || !defaultCollapsed;
  const list = <ChangelogEntryListSkeleton />;
  return (
    <div className={cn(SECTION_CLASS, className)} aria-hidden>
      {!hideTitle &&
        (collapsible ? (
          <div className={COLLAPSIBLE_TITLE_ROW_CLASS}>
            {heading}
            <ChevronDown className={cn(CHEVRON_CLASS, !defaultCollapsed && 'rotate-180')} />
          </div>
        ) : (
          heading
        ))}
      {showEntries &&
        (inPreviewMode ? (
          <div className="relative">
            <div className="overflow-hidden" style={{ maxHeight: PREVIEW_COLLAPSED_HEIGHT }}>
              {list}
            </div>
            <UnifiedSkeleton className={PREVIEW_TOGGLE_SKELETON_CLASS} />
          </div>
        ) : (
          list
        ))}
    </div>
  );
}

function ChangelogEntryListSkeleton() {
  return (
    <ul className={ENTRY_LIST_CLASS}>
      <LoadingItems count={CHANGELOG_SKELETON_ENTRIES}>
        {() => (
          <li className={ENTRY_CLASS} data-loading-item>
            <div className={ENTRY_TITLE_CLASS}>
              <TextLineSkeleton type="h3" className="w-2/3" />
            </div>
            <div className={ENTRY_DESCRIPTION_CLASS}>
              {/* Five lines: in preview mode the entry runs past the 120px clamp, as a real first entry does. */}
              <TextLineSkeleton type="inherit" lines={5} className="w-full" />
            </div>
          </li>
        )}
      </LoadingItems>
    </ul>
  );
}
