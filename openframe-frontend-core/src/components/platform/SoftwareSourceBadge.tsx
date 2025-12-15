/**
 * SoftwareSourceBadge Component
 *
 * Displays a badge for software source types from Fleet MDM.
 * Supports all osquery software source types with appropriate styling.
 *
 * Fleet MDM Software Sources:
 * - apps: macOS Applications
 * - chrome_extensions: Chrome Browser Extensions
 * - firefox_addons: Firefox Browser Extensions
 * - safari_extensions: Safari Browser Extensions
 * - ie_extensions: Internet Explorer Extensions
 * - vscode_extensions: VS Code Extensions
 * - atom_packages: Atom Packages
 * - homebrew_packages: Homebrew Packages (macOS)
 * - npm_packages: NPM Packages
 * - python_packages: Python Packages
 * - apt_sources: APT Packages (Debian/Ubuntu)
 * - deb_packages: DEB Packages
 * - rpm_packages: RPM Packages (Red Hat/CentOS)
 * - yum_sources: YUM Packages
 * - portage_packages: Portage Packages (Gentoo)
 * - chocolatey_packages: Chocolatey Packages (Windows)
 * - programs: Windows Programs
 * - pkg_packages: PKG Packages
 *
 * @example
 * ```tsx
 * <SoftwareSourceBadge source="apps" />
 * <SoftwareSourceBadge source="chrome_extensions" />
 * <SoftwareSourceBadge source="python_packages" />
 * ```
 */

import React from 'react'
import { Button } from '../ui/button'
import {
  PackageIcon,
  WindowsIcon,
  MacOSIcon,
  LinuxIcon
} from '../icons'
import { cn } from '../../utils/common'

export type SoftwareSource =
  | 'apps'
  | 'chrome_extensions'
  | 'firefox_addons'
  | 'safari_extensions'
  | 'ie_extensions'
  | 'vscode_extensions'
  | 'atom_packages'
  | 'homebrew_packages'
  | 'npm_packages'
  | 'python_packages'
  | 'apt_sources'
  | 'deb_packages'
  | 'rpm_packages'
  | 'yum_sources'
  | 'portage_packages'
  | 'chocolatey_packages'
  | 'programs'
  | 'pkg_packages'

export interface SoftwareSourceBadgeProps {
  /** Software source type from Fleet MDM */
  source: SoftwareSource
  /** Additional CSS classes */
  className?: string
}

/**
 * Maps source types to human-readable labels and icons
 */
const sourceConfig: Record<SoftwareSource, { label: string; icon: React.ReactNode }> = {
  apps: { label: 'App', icon: <MacOSIcon className="w-4 h-4" /> },
  chrome_extensions: { label: 'Chrome', icon: <PackageIcon className="w-4 h-4" /> },
  firefox_addons: { label: 'Firefox', icon: <PackageIcon className="w-4 h-4" /> },
  safari_extensions: { label: 'Safari', icon: <PackageIcon className="w-4 h-4" /> },
  ie_extensions: { label: 'IE', icon: <PackageIcon className="w-4 h-4" /> },
  vscode_extensions: { label: 'VS Code', icon: <PackageIcon className="w-4 h-4" /> },
  atom_packages: { label: 'Atom', icon: <PackageIcon className="w-4 h-4" /> },
  homebrew_packages: { label: 'Homebrew', icon: <MacOSIcon className="w-4 h-4" /> },
  npm_packages: { label: 'NPM', icon: <PackageIcon className="w-4 h-4" /> },
  python_packages: { label: 'Python', icon: <PackageIcon className="w-4 h-4" /> },
  apt_sources: { label: 'APT', icon: <LinuxIcon className="w-4 h-4" /> },
  deb_packages: { label: 'DEB', icon: <LinuxIcon className="w-4 h-4" /> },
  rpm_packages: { label: 'RPM', icon: <LinuxIcon className="w-4 h-4" /> },
  yum_sources: { label: 'YUM', icon: <LinuxIcon className="w-4 h-4" /> },
  portage_packages: { label: 'Portage', icon: <LinuxIcon className="w-4 h-4" /> },
  chocolatey_packages: { label: 'Chocolatey', icon: <WindowsIcon className="w-4 h-4" /> },
  programs: { label: 'Windows', icon: <WindowsIcon className="w-4 h-4" /> },
  pkg_packages: { label: 'PKG', icon: <PackageIcon className="w-4 h-4" /> }
}

export const SoftwareSourceBadge: React.FC<SoftwareSourceBadgeProps> = ({
  source,
  className
}) => {
  const config = sourceConfig[source] || { label: source, icon: <PackageIcon className="w-4 h-4" /> }

  return (
    <Button
      variant="table-display"
      size="none"
      leftIcon={config.icon}
      className={cn(className)}
      alignment='left'
    >
      {config.label}
    </Button>
  )
}

SoftwareSourceBadge.displayName = 'SoftwareSourceBadge'
