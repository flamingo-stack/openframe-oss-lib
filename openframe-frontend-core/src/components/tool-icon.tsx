import type { FC } from 'react';
import { type ToolType, ToolTypeValues } from '../types/tool.types';
import { findIcon, type IconComponent } from './chat/utils/icon-library';

/**
 * Each tool's mark, by its NAME in the icon set. Every mark is the grey
 * (`currentColor`) cut of the brand logo, the OpenFrame one included, so a row
 * of tool icons reads as one set and takes the text colour of wherever it sits.
 *
 * Named, not imported: the set's resolver loads a mark when a tool is drawn. A
 * static import put every tool's logo (the MeshCentral one is an embedded
 * picture, 58 KB) into every page that can show a toast.
 */
const TOOL_ICON_NAME: Record<ToolType, string | null> = {
  [ToolTypeValues.FLEET_MDM]: 'fleet-mdm-logo-grey',
  [ToolTypeValues.MESHCENTRAL]: 'meshcentral-logo-grey',
  [ToolTypeValues.OPENFRAME]: 'openframe-logo-grey',
  [ToolTypeValues.OPENFRAME_CHAT]: 'openframe-logo-grey',
  [ToolTypeValues.OPENFRAME_CLIENT]: 'openframe-logo-grey',
  [ToolTypeValues.OPENFRAME_RMM]: 'openframe-logo-grey',
  [ToolTypeValues.AUTHENTIK]: 'authentik-logo-grey',
  [ToolTypeValues.OSQUERY]: 'osquery-logo-grey',
  [ToolTypeValues.SYSTEM]: null,
  [ToolTypeValues.MICROSOFT_365]: 'office-365-logo-grey',
  [ToolTypeValues.GOOGLE_WORKSPACE]: 'google-logo-grey',
};

export interface ToolIconProps {
  toolType: ToolType;
  size?: number;
  className?: string;
}

/** Each tool's mark as a component. Building one fetches nothing: the mark's module loads when it is first drawn. */
const TOOL_ICONS = Object.fromEntries(
  Object.entries(TOOL_ICON_NAME).map(([tool, name]) => [tool, findIcon(name)]),
) as Record<ToolType, IconComponent | null>;

export const ToolIcon: FC<ToolIconProps> = ({ toolType, size = 16, className }) => {
  const Icon = TOOL_ICONS[toolType];
  return Icon ? <Icon size={size} className={className} /> : null;
};

ToolIcon.displayName = 'ToolIcon';
