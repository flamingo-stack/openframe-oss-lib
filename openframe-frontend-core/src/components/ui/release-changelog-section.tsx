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
  SimpleMarkdownRenderer: React.ComponentType<{ content: string }>;
}

export function ReleaseChangelogSection({
  title,
  entries,
  isBreaking = false,
  hideTitle = false,
  collapsible = false,
  defaultCollapsed = true,
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
            {title}
            <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
          </h2>
        )
      )}
      {showEntries && (
        <ul className="space-y-6">
          {entries.map((entry, index) => (
            <li key={index} className="border-l-2 border-ods-border pl-4 ml-0">
              <p className="font-['DM_Sans'] font-semibold text-[20px] leading-[24px] text-ods-text-primary mb-2">{entry.title}</p>
              {entry.description && (
                <div className="[&_p]:!font-['DM_Sans'] [&_p]:!font-medium [&_p]:!text-[18px] [&_p]:!leading-[24px] [&_p]:!text-ods-text-primary [&_p]:!my-1">
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
