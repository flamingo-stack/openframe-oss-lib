'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { Copy02Icon } from '../icons-v2-generated/documents/copy-02-icon';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { LoadingItems, useLoadingScope } from '../ui/loading-scope';

export interface PathsDisplayProps {
  /**
   * Array of file/folder paths to display
   */
  paths: readonly string[] | string[];

  /**
   * Callback when a path is copied
   */
  onCopyPath?: (path: string) => void;

  /**
   * Optional title above the paths list
   */
  title?: string;

  /**
   * Optional description text
   */
  description?: string;

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Whether to show copy buttons (default: true)
   */
  showCopyButtons?: boolean;

  /**
   * Size of the copy icon (default: 'w-6 h-6')
   */
  copyIconSize?: string;

  /**
   * Optional icon rendered at the start of every row, before the path text.
   * Useful for showing a platform logo next to a command (e.g. the Windows
   * logo beside "Run PowerShell as Local Administrator").
   */
  leadingIcon?: React.ReactNode;
}

/** The list's layout, read by the list and by its skeleton, so the skeleton is the list's size. */
const PATHS_CLASS = 'flex flex-col gap-3';
const PATHS_TITLE_CLASS = 'text-ods-text-primary text-h4';
const PATHS_DESCRIPTION_CLASS = 'text-ods-text-secondary text-h6';
const PATHS_FRAME_CLASS = 'overflow-hidden rounded-[6px] border border-ods-border bg-ods-bg';
const PATHS_ROW_CLASS = 'flex items-center gap-4 border-b border-ods-border p-4 last:border-b-0';
const PATHS_COPY_BUTTON_CLASS =
  'shrink-0 rounded-md text-ods-text-secondary transition-colors hover:text-ods-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus';
/** How many rows the skeleton draws when the paths are read with the page. */
export const PATHS_DISPLAY_SKELETON_ROWS = 2;
const PATH_SKELETON_WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-1/3'] as const;

/**
 * PathsDisplay - Unified component for displaying file/folder paths with copy functionality
 *
 * Features:
 * - Displays a list of paths in a styled container
 * - Optional copy-to-clipboard functionality
 * - Monospace font for paths
 * - Consistent ODS styling
 *
 * Usage Example:
 * ```tsx
 * import { PathsDisplay } from '@flamingo/ui-kit/components/features'
 *
 * const windowsPaths = [
 *   'C:\\Program Files\\OpenFrame\\',
 *   'C:\\ProgramData\\OpenFrame\\'
 * ]
 *
 * <PathsDisplay
 *   paths={windowsPaths}
 *   title="Antivirus Exclusions"
 *   description="Add these folders to your antivirus exclusions list"
 *   onCopyPath={(path) => {
 *     navigator.clipboard.writeText(path)
 *     toast({ title: 'Copied', description: 'Path copied to clipboard' })
 *   }}
 * />
 * ```
 */
export function PathsDisplay({
  paths,
  onCopyPath,
  title,
  description,
  className,
  showCopyButtons = true,
  copyIconSize = 'w-6 h-6',
  leadingIcon,
}: PathsDisplayProps) {
  // Paths that are read arrive empty in a page's loading state: the list is its skeleton, never left out.
  // Paths a page states itself (`OPENFRAME_PATHS`) are its own words and draw as they are.
  const inScope = useLoadingScope();
  if (!paths || paths.length === 0) {
    if (inScope) {
      return (
        <PathsDisplaySkeleton
          title={title}
          description={description}
          showCopyButtons={showCopyButtons && !!onCopyPath}
          copyIconSize={copyIconSize}
          leadingIcon={leadingIcon}
          className={className}
        />
      );
    }
    return null;
  }

  return (
    <div className={cn(PATHS_CLASS, className)}>
      {title && <div className={PATHS_TITLE_CLASS}>{title}</div>}
      {description && <div className={PATHS_DESCRIPTION_CLASS}>{description}</div>}
      <div className={PATHS_FRAME_CLASS}>
        {paths.map(path => (
          <div key={path} className={PATHS_ROW_CLASS} data-loading-item>
            {leadingIcon && <span className="shrink-0 text-ods-text-primary">{leadingIcon}</span>}
            <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h4">{path}</span>
            {showCopyButtons && onCopyPath && (
              <button
                type="button"
                onClick={() => onCopyPath(path)}
                aria-label={`Copy ${path}`}
                className={PATHS_COPY_BUTTON_CLASS}
              >
                <Copy02Icon className={copyIconSize} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The paths list while its paths are read: the same frame, its title, description, leading icon and copy glyph for
 * real, and `rows` rows with a bar of a path each.
 */
export function PathsDisplaySkeleton({
  rows = PATHS_DISPLAY_SKELETON_ROWS,
  title,
  description,
  showCopyButtons = true,
  copyIconSize = 'w-6 h-6',
  leadingIcon,
  className,
}: Pick<
  PathsDisplayProps,
  'title' | 'description' | 'showCopyButtons' | 'copyIconSize' | 'leadingIcon' | 'className'
> & {
  rows?: number;
}) {
  return (
    <div className={cn(PATHS_CLASS, className)} aria-hidden>
      {title && <div className={PATHS_TITLE_CLASS}>{title}</div>}
      {description && <div className={PATHS_DESCRIPTION_CLASS}>{description}</div>}
      <div className={PATHS_FRAME_CLASS}>
        <LoadingItems count={rows}>
          {i => (
            <div className={PATHS_ROW_CLASS} data-loading-item>
              {leadingIcon && <span className="shrink-0 text-ods-text-primary">{leadingIcon}</span>}
              <div className="min-w-0 flex-1">
                <TextLineSkeleton type="h4" className={PATH_SKELETON_WIDTHS[i % PATH_SKELETON_WIDTHS.length]} />
              </div>
              {showCopyButtons && (
                <span className={PATHS_COPY_BUTTON_CLASS}>
                  <Copy02Icon className={copyIconSize} />
                </span>
              )}
            </div>
          )}
        </LoadingItems>
      </div>
    </div>
  );
}

/**
 * Pre-defined path sets for common use cases
 */
export const OPENFRAME_PATHS = {
  windows: [
    'C:\\Program Files\\OpenFrame',
    'C:\\ProgramData\\OpenFrame',
    'C:\\ProgramData\\OpenFrameInstall',
    'C:\\Program Files\\Orbit',
  ],
  darwin: [
    '/Library/LaunchDaemons/com.openframe.client.plist',
    '/Library/Application Support/OpenFrame/meshcentral-agent/',
  ],
  linux: ['/opt/openframe/'],
} as const;

export type OpenFramePathsPlatform = keyof typeof OPENFRAME_PATHS;

/**
 * Get OpenFrame paths for a specific platform
 */
export function getOpenFramePaths(platform: OpenFramePathsPlatform): string[] {
  return [...OPENFRAME_PATHS[platform]];
}

/**
 * Doctor command per platform. Run to diagnose installation issues and repair
 * the agent (works even if the agent didn't install correctly).
 */
export const OPENFRAME_DOCTOR_COMMANDS: Record<OpenFramePathsPlatform, string> = {
  // PowerShell: Invoke-WebRequest / .\openframe-client.exe, mirroring the
  // Windows install command pattern.
  windows:
    "Set-Location ~; Invoke-WebRequest -Uri 'github.com/openframe-client' -OutFile 'openframe-client.exe'; .\\openframe-client.exe doctor",
  darwin: 'cd ~; wget github.com/openframe-client; openframe-client doctor',
  linux: 'cd ~; wget github.com/openframe-client; openframe-client doctor',
} as const;

/**
 * Get the OpenFrame doctor command for a specific platform
 */
export function getOpenFrameDoctorCommand(platform: OpenFramePathsPlatform): string {
  return OPENFRAME_DOCTOR_COMMANDS[platform];
}
