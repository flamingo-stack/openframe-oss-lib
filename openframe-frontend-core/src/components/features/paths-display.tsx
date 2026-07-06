'use client'

import React from 'react'
import { Copy02Icon } from '../icons-v2-generated/documents/copy-02-icon'
import { cn } from '../../utils/cn'

export interface PathsDisplayProps {
  /**
   * Array of file/folder paths to display
   */
  paths: readonly string[] | string[]

  /**
   * Callback when a path is copied
   */
  onCopyPath?: (path: string) => void

  /**
   * Optional title above the paths list
   */
  title?: string

  /**
   * Optional description text
   */
  description?: string

  /**
   * Additional CSS classes for the container
   */
  className?: string

  /**
   * Whether to show copy buttons (default: true)
   */
  showCopyButtons?: boolean

  /**
   * Size of the copy icon (default: 'w-6 h-6')
   */
  copyIconSize?: string

  /**
   * Optional icon rendered at the start of every row, before the path text.
   * Useful for showing a platform logo next to a command (e.g. the Windows
   * logo beside "Run PowerShell as Local Administrator").
   */
  leadingIcon?: React.ReactNode
}

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
  leadingIcon
}: PathsDisplayProps) {
  if (!paths || paths.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {title && (
        <div className="text-h4 text-ods-text-primary">
          {title}
        </div>
      )}
      {description && (
        <div className="text-h6 text-ods-text-secondary">
          {description}
        </div>
      )}
      <div className="bg-ods-bg border border-ods-border rounded-[6px] overflow-hidden">
        {paths.map((path) => (
          <div
            key={path}
            className="flex items-center gap-4 p-4 border-b border-ods-border last:border-b-0"
          >
            {leadingIcon && (
              <span className="shrink-0 text-ods-text-primary">{leadingIcon}</span>
            )}
            <span className="flex-1 min-w-0 text-h4 text-ods-text-primary truncate">
              {path}
            </span>
            {showCopyButtons && onCopyPath && (
              <button
                type="button"
                onClick={() => onCopyPath(path)}
                aria-label={`Copy ${path}`}
                className="shrink-0 rounded-md text-ods-text-secondary transition-colors hover:text-ods-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
              >
                <Copy02Icon className={copyIconSize} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Pre-defined path sets for common use cases
 */
export const OPENFRAME_PATHS = {
  windows: [
    'C:\\Program Files\\OpenFrame',
    'C:\\ProgramData\\OpenFrame',
    'C:\\ProgramData\\OpenFrameInstall',
    'C:\\Program Files\\Orbit'
  ],
  darwin: [
    '/Library/LaunchDaemons/com.openframe.client.plist',
    '/Library/Application Support/OpenFrame/meshcentral-agent/'
  ],
  linux: [
    '/opt/openframe/'
  ]
} as const

export type OpenFramePathsPlatform = keyof typeof OPENFRAME_PATHS

/**
 * Get OpenFrame paths for a specific platform
 */
export function getOpenFramePaths(platform: OpenFramePathsPlatform): string[] {
  return [...OPENFRAME_PATHS[platform]]
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
  linux: 'cd ~; wget github.com/openframe-client; openframe-client doctor'
} as const

/**
 * Get the OpenFrame doctor command for a specific platform
 */
export function getOpenFrameDoctorCommand(platform: OpenFramePathsPlatform): string {
  return OPENFRAME_DOCTOR_COMMANDS[platform]
}
