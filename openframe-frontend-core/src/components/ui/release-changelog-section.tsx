import React from 'react';
import { Badge } from './badge';
import type { ChangelogEntry } from '../../types/product-release';

interface ReleaseChangelogSectionProps {
  title: string;
  entries: ChangelogEntry[];
  isBreaking?: boolean;
  hideTitle?: boolean;
  SimpleMarkdownRenderer: React.ComponentType<{ content: string }>;
}

export function ReleaseChangelogSection({
  title,
  entries,
  isBreaking = false,
  hideTitle = false,
  SimpleMarkdownRenderer
}: ReleaseChangelogSectionProps) {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h2 className={`flex items-center gap-2 text-2xl font-bold ${isBreaking ? 'text-red-500' : 'text-ods-text-primary'}`}>
          {title}
          <Badge variant="secondary" className="ml-2">{entries.length}</Badge>
        </h2>
      )}
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
    </div>
  );
}
