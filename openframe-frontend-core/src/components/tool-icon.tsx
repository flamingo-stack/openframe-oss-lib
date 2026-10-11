import { createElement, type FC } from 'react';
import type { ToolType } from '../types/tool.types';
import { findIcon, type IconComponent } from './chat/utils/icon-library';

export interface ToolIconProps {
  toolType: ToolType;
  size?: number;
  className?: string;
}

/** Each tool's mark, found once per tool. */
const TOOL_ICONS = new Map<string, IconComponent | null>();

/**
 * A tool's mark, by CONVENTION: the grey (`currentColor`) cut of the logo named
 * after the tool in the icon set, `<tool>-logo-grey`, so a row of tool icons
 * reads as one set and takes the text colour of wherever it sits. A tool that
 * is a part of a product draws the product's mark: the tool's leading words are
 * tried longest first (`OPENFRAME_CHAT` is `openframe-chat-logo-grey`, then
 * `openframe-logo-grey`). A tool with no logo by its name (`SYSTEM`) has no mark.
 *
 * No list of tools: a new tool is drawn the day its logo is in the icon set.
 * Named, never imported: the set's resolver loads a mark when it is drawn.
 */
function toolIcon(toolType: string): IconComponent | null {
  const known = TOOL_ICONS.get(toolType);
  if (known !== undefined) return known;
  const words = toolType.toLowerCase().split('_').filter(Boolean);
  let icon: IconComponent | null = null;
  for (let count = words.length; count >= 1 && !icon; count -= 1) {
    icon = findIcon(`${words.slice(0, count).join('-')}-logo-grey`);
  }
  TOOL_ICONS.set(toolType, icon);
  return icon;
}

export const ToolIcon: FC<ToolIconProps> = ({ toolType, size = 16, className }) => {
  // A mark found by its name, drawn through `createElement`: it is the icon set's component, not one made here.
  const icon = toolIcon(toolType);
  return icon ? createElement(icon, { size, className }) : null;
};

ToolIcon.displayName = 'ToolIcon';
