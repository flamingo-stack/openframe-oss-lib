import { ICON_SIZE } from '../../styles/component-sizes';
/**
 * A tool or source mark's 16px box (`ToolBadge`'s mark, the "Data synced from" line's source glyph): read by the marks
 * and by every skeleton that stands for one. A leaf, so a `ui` component can read it without loading the badge.
 */
export const TOOL_MARK_CLASS = `flex ${ICON_SIZE.sm} shrink-0 items-center justify-center`;
