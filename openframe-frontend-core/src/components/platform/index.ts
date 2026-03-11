'use client';

/**
 * Platform Components
 *
 * OpenFrame-specific platform components for device management,
 * software inventory, and system information display.
 */

export type { ShellType } from '../../types/shell.types';
export type { ToolType } from '../../types/tool.types';
export type { CveLinkProps } from './CveLink';
export { CveLink } from './CveLink';
export type { ScriptArgument, ScriptArgumentsProps } from './ScriptArguments';
export { ScriptArguments } from './ScriptArguments';
export type { ScriptAuthor, ScriptInfoSectionProps } from './ScriptInfoSection';
export { ScriptInfoSection } from './ScriptInfoSection';
export type { ShellTypeBadgeProps } from './ShellTypeBadge';

export { ShellTypeBadge } from './ShellTypeBadge';
export type { SoftwareInfoProps } from './SoftwareInfo';
export { SoftwareInfo } from './SoftwareInfo';
export type { SoftwareSource, SoftwareSourceBadgeProps } from './SoftwareSourceBadge';
export { SoftwareSourceBadge } from './SoftwareSourceBadge';
export type { ToolBadgeProps } from './ToolBadge';
export { ToolBadge } from './ToolBadge';
