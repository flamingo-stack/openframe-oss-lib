/**
 * Platform Components
 *
 * OpenFrame-specific platform components for device management,
 * software inventory, and system information display.
 */

export { SoftwareInfo } from './SoftwareInfo'
export type { SoftwareInfoProps } from './SoftwareInfo'

export { SoftwareSourceBadge } from './SoftwareSourceBadge'
export type { SoftwareSourceBadgeProps, SoftwareSource } from './SoftwareSourceBadge'

export { CveLink } from './CveLink'
export type { CveLinkProps } from './CveLink'

export { ToolBadge } from './ToolBadge'
export type { ToolBadgeProps } from './ToolBadge'
export type { ToolType } from '../../types/tool.types'

export { ShellTypeBadge } from './ShellTypeBadge'
export type { ShellTypeBadgeProps } from './ShellTypeBadge'
export type { ShellType } from '../../types/shell.types'
