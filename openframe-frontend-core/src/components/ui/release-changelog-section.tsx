"use client"

import React, { useState } from 'react';
import { Badge } from './badge';
import { ChevronDown } from 'lucide-react';
import type { ChangelogEntry } from '../../types/product-release';

interface ReleaseChangelogSectionProps {
  title: string;
  entries: ChangelogEntry[];
  isBreaking?: boolean;
  hideTitle?: boolean;
  /** When true, section starts collapsed and can be toggled open/closed */
  collapsible?: boolean;
  /** Initial collapsed state (only used when collapsible=true). Defaults to true (collapsed). */
  defaultCollapsed?: boolean;
  /** Optional lucide icon rendered inline before the title text. Matches the
   *  catalog card's changelog-strip icons (Sparkles for Features, Wrench for
   *  Fixes, TrendingUp for Improvements, AlertTriangle for Breaking) — same
   *  visual taxonomy across catalog and detail. Inherits the title's color
   *  (secondary for normal sections, red for breaking). */
  icon?: React.ReactNode;
  SimpleMarkdownRenderer: React.ComponentType<{ content: string }>;
}

export function ReleaseChangelogSection({
  title,
  entries,
  isBreaking = false,
  hideTitle = false,
  collapsible = false,
  defaultCollapsed = true,
  icon,
  SimpleMarkdownRenderer
}: ReleaseChangelogSectionProps) {
  const [collapsed, setCollapsed] = useState(collapsible ? defaultCollapsed : false);

  if (!entries || entries.length === 0) return null;

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
                   summary (release-detail-page.tsx:321) at the SAME 14/18px
                   responsive `text-h4` scale. The `SimpleMarkdownRenderer`
                   forces its own `<p>` typography
                   (`text-[16px] md:text-[18px] lg:text-[20px]`) which
                   overrides the wrapper's `text-h4` on `lg+` viewports and
                   inflates the changelog body to 20px — larger than the
                   main summary AND larger than the entry title.
                   The `[&_p]:!` overrides pin every descendant `<p>` back
                   to the h4 responsive tokens (`var(--font-size-h4-body)`
                   + `var(--font-line-space-h4-body)`) — same variables
                   `text-h4` itself uses, so the responsive breakpoints
                   stay aligned with the rest of the page. */
                <div className="text-h4 text-ods-text-primary [&_p]:!text-[length:var(--font-size-h4-body)] [&_p]:!leading-[var(--font-line-space-h4-body)] [&_p]:!font-medium">
                  <SimpleMarkdownRenderer content={entry.description} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
