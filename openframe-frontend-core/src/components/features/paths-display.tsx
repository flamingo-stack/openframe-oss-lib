'use client'

import React from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../ui/button'
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
   * Size of the copy icon (default: 'w-5 h-5')
   */
  copyIconSize?: string
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
  copyIconSize = 'w-5 h-5'
}: PathsDisplayProps) {
  if (!paths || paths.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {title && (
        <div className="text-ods-text-primary text-[16px] md:text-[18px]">
          {title}
        </div>
      )}
      {description && (
        <div className="text-ods-text-secondary text-[14px] md:text-[16px]">
          {description}
        </div>
      )}
      <div className="bg-ods-bg border border-ods-border rounded-[6px] overflow-hidden">
        {paths.map((path) => (
          <div
            key={path}
            className="flex items-center justify-between p-4 border-b border-ods-border last:border-b-0"
          >
            <span className="text-ods-text-primary font-medium text-[14px] md:text-[16px] font-mono break-all">
              {path}
            </span>
            {showCopyButtons && onCopyPath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopyPath(path)}
                className="ml-4 shrink-0"
              >
                <Copy className={copyIconSize} />
              </Button>
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
    'C:\\Program Files\\TacticalAgent',
    'C:\\ProgramData\\OpenFrame',
    'C:\\ProgramData\\TacticalRMM',
    'C:\\Program Files\\Orbit'
  ],
  darwin: [
    '/Library/LaunchDaemons/com.openframe.client.plist',
    '/Library/Application Support/OpenFrame/meshcentral-agent/'
  ],
  linux: [
    '/opt/openframe/',
    '/usr/local/bin/tacticalagent',
    '/opt/tacrmm'
  ]
} as const

export type OpenFramePathsPlatform = keyof typeof OPENFRAME_PATHS

/**
 * Get OpenFrame paths for a specific platform
 */
export function getOpenFramePaths(platform: OpenFramePathsPlatform): string[] {
  return [...OPENFRAME_PATHS[platform]]
}
