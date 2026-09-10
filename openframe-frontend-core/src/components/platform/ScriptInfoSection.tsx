/**
 * ScriptInfoSection Component
 *
 * Displays script information in a card with header (title, description)
 * and detail cells (shell type, supported platforms, category, author).
 * Responsive layout: stacks cells on mobile, shows grid on desktop.
 */

import type React from 'react';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { nameInitials } from '../../utils/format';
import { getOSLabel } from '../../utils/os-utils';
import { getShellLabel } from '../../utils/shell-utils';

/**
 * Props for author avatar display
 */
export interface ScriptAuthor {
  /** Author name */
  name: string;
  /** Author initials (used when no photo) */
  initials?: string;
  /** URL to author's photo */
  photoUrl?: string;
}

/**
 * Props for ScriptInfoSection component
 */
export interface ScriptInfoSectionProps {
  /** Script title/name */
  headline: string;
  /** Script description */
  subheadline?: string;
  /** Shell type (POWERSHELL, BASH, CMD, etc.) */
  shellType?: string;
  /** Array of supported platform strings (windows, darwin, linux, etc.) */
  supportedPlatforms?: string[];
  /** Script category */
  category: string;
  /** Author information */
  author?: ScriptAuthor;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Formats supported platforms array into a display string
 * @param platforms - Array of platform strings (e.g., ['windows', 'darwin', 'linux'])
 * @returns Formatted string (e.g., 'Windows, macOS, Linux')
 */
function formatSupportedPlatforms(platforms?: string[]): string {
  if (!platforms || platforms.length === 0) {
    return 'All Platforms';
  }
  return platforms.map(platform => getOSLabel(platform)).join(', ');
}

/**
 * InfoCell - Single info cell with label and value
 */
interface InfoCellProps {
  label: string;
  value: string;
  avatar?: ScriptAuthor;
  className?: string;
}

function InfoCell({ label, value, avatar, className }: InfoCellProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {/* Avatar for author cell */}
      {avatar && (
        <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-ods-border bg-ods-bg">
          {avatar.photoUrl ? (
            <Image src={avatar.photoUrl} alt={avatar.name} className="object-cover" fill sizes="32px" unoptimized />
          ) : (
            <div className="flex size-full items-center justify-center text-ods-text-secondary text-h6">
              {avatar.initials || nameInitials(avatar.name)}
            </div>
          )}
        </div>
      )}

      {/* Text content */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-ods-text-primary text-h4" title={value}>
          {value}
        </span>
        <span className="truncate text-ods-text-secondary text-h6">{label}</span>
      </div>
    </div>
  );
}

/**
 * ScriptInfoSection - Displays script information in a structured card
 *
 * @example
 * ```tsx
 * <ScriptInfoSection
 *   title="System Backup Script"
 *   description="Comprehensive Linux system backup script..."
 *   shellType="BASH"
 *   supportedPlatforms={['linux']}
 *   category="System Maintenance"
 *   author={{ name: 'John Doe', photoUrl: '/avatars/john.jpg' }}
 * />
 * ```
 */
export const ScriptInfoSection: React.FC<ScriptInfoSectionProps> = ({
  headline,
  subheadline,
  shellType,
  supportedPlatforms,
  category,
  author,
  className,
}) => {
  const shellLabel = getShellLabel(shellType);
  const platformsLabel = formatSupportedPlatforms(supportedPlatforms);

  return (
    <div className={cn('overflow-hidden rounded-[6px] border border-ods-border bg-ods-card', className)}>
      {/* Header row with title and description */}
      <div className="border-b border-ods-border p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-ods-text-primary text-h4">{headline}</h3>
          {subheadline && <p className="break-words text-ods-text-secondary text-h6">{subheadline}</p>}
        </div>
      </div>

      {/* Details section with info cells
          - Mobile/Tablet (<lg): 2x2 grid with divider between rows
          - Desktop (lg+): 4 columns in single row
      */}
      {/* First row: Shell Type, Supported Platforms */}
      <div className="grid grid-cols-2 gap-4 border-b border-ods-border px-4 py-4 lg:grid-cols-4 lg:border-b-0">
        <InfoCell label="Shell Type" value={shellLabel} />
        <InfoCell label="Supported Platforms" value={platformsLabel} />
        {/* Desktop only: Category and Author in same row */}
        <InfoCell label="Category" value={category} className="hidden lg:flex" />
        {author && <InfoCell label="Added by" value={author.name} avatar={author} className="hidden lg:flex" />}
      </div>
      {/* Second row (mobile/tablet only): Category, Author */}
      <div className="grid grid-cols-2 gap-4 px-4 py-4 lg:hidden">
        <InfoCell label="Category" value={category} />
        {author && <InfoCell label="Added by" value={author.name} avatar={author} />}
      </div>
    </div>
  );
};

ScriptInfoSection.displayName = 'ScriptInfoSection';
