/**
 * ToolBadge Component
 *
 * Displays a tool type badge with icon for OpenFrame integrated tools.
 * Used in tables to show tool sources like Fleet MDM, MeshCentral, etc.
 */

import type React from 'react';
import Link from '../../embed-shims/next-link';
import type { ToolType } from '../../types/tool.types';
import { cn } from '../../utils/cn';
import { getToolLabel } from '../../utils/tool-utils';
import { NavLinkAnchorViaRuntime } from '../chat/nav-link-anchor-via-runtime';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { ToolIcon } from '../tool-icon';
import { useLoadingScope } from '../ui/loading-scope';

export type { ToolType } from '../../types/tool.types';

export interface ToolBadgeProps {
  /** A built-in tool: its label and grey mark come from the tool registry. */
  toolType?: ToolType;
  /** The text. Required without `toolType`; with it, replaces the registry label. */
  label?: string;
  /** The mark. Required for a tool outside the registry; replaces the registry mark otherwise. */
  icon?: React.ReactNode;
  /**
   * `inline` (default): mark and label in the surrounding text (a table cell).
   * `chip`: a 28px dark chip with a monochrome mark, for a row of "built on"
   * badges on a card.
   */
  variant?: 'inline' | 'chip';
  /**
   * Where the tool is described (its page in a directory). The badge becomes a
   * link that opens it in a new tab; without it the badge is plain text.
   */
  href?: string | null;
  /**
   * The platform `href` is on, by name, when it is one of the host's own
   * platforms. The badge then opens through the shared navigation rule (the
   * one chat cards use); the host must mount the chat runtime.
   */
  targetPlatform?: string | null;
  /** Additional CSS classes */
  className?: string;
  iconClassName?: string;
}

/** The badge's layout, read by the badge and by its skeleton, so the skeleton is the badge's size. */
// The house tag (Figma `tag`): 32px, on the card surface, the caption face.
const CHIP_CLASS =
  'inline-flex h-8 items-center gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)] text-ods-text-primary text-h5';
const CHIP_MARK_CLASS = 'flex h-4 w-4 shrink-0 items-center justify-center';
const INLINE_CLASS = 'flex items-center gap-1 text-ods-text-secondary';
/**
 * A tool's name while it loads, in characters of its own face (the chip's caption face is monospaced, so `ch` is one
 * character): a typical tool name ("MeshCentral", "Tactical RMM") is 11 to 13.
 */
const CHIP_NAME_TYPICAL_CH = '11ch';

export interface ToolBadgeSkeletonProps {
  variant?: 'inline' | 'chip';
  /** Whether the badge leads with its mark (default true). */
  icon?: boolean;
  className?: string;
}

/** A badge while its tool is read: the chip's own frame (or the inline row), a mark box and a bar for the name. */
export function ToolBadgeSkeleton({ variant = 'inline', icon = true, className }: ToolBadgeSkeletonProps) {
  if (variant === 'chip') {
    return (
      <span className={cn(CHIP_CLASS, className)} aria-hidden>
        {icon && <UnifiedSkeleton as="span" className={cn(CHIP_MARK_CLASS, 'rounded-sm')} />}
        <TextLineSkeleton type="h5" width={CHIP_NAME_TYPICAL_CH} />
      </span>
    );
  }
  return (
    <div className={cn(INLINE_CLASS, className)} aria-hidden>
      {icon && <UnifiedSkeleton className="size-4 shrink-0 rounded-sm" />}
      <TextLineSkeleton type="h4" className="w-20" />
    </div>
  );
}

/**
 * One tool, named: a mark and a label. Pass a `toolType` for a tool the
 * registry knows, or `label` + `icon` for one it does not (a connector or a
 * package manager that is content, not a built-in tool).
 */
export const ToolBadge: React.FC<ToolBadgeProps> = ({
  toolType,
  label,
  icon,
  variant = 'inline',
  href,
  targetPlatform,
  className,
  iconClassName,
}) => {
  const loading = useLoadingScope();
  const text = label ?? (toolType ? getToolLabel(toolType) : '');
  const mark = icon ?? (toolType ? <ToolIcon toolType={toolType} className={iconClassName} size={16} /> : null);

  if (loading) return <ToolBadgeSkeleton variant={variant} icon={!!mark} className={className} />;

  // One rule for both variants: with an `href` the badge is a link.
  const linked = (node: React.ReactElement, linkClassName: string) =>
    href && targetPlatform ? (
      <NavLinkAnchorViaRuntime
        href={href}
        targetPlatform={targetPlatform}
        title={text || undefined}
        className={linkClassName}
      >
        {node}
      </NavLinkAnchorViaRuntime>
    ) : href ? (
      <Link href={href} target="_blank" rel="noopener noreferrer" title={text || undefined} className={linkClassName}>
        {node}
      </Link>
    ) : (
      node
    );

  if (variant === 'chip') {
    return linked(
      <span className={cn(CHIP_CLASS, href && 'transition-colors hover:border-ods-border-hover', className)}>
        {mark && (
          <span
            className={cn(
              CHIP_MARK_CLASS,
              '[&_img]:h-full [&_img]:w-full [&_img]:rounded-sm [&_img]:object-contain [&_svg]:h-full [&_svg]:w-full',
            )}
          >
            {mark}
          </span>
        )}
        {text && <span className="whitespace-nowrap">{text}</span>}
      </span>,
      'inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
    );
  }

  return linked(
    <div className={cn(INLINE_CLASS, className)}>
      {mark}
      <span className="text-ods-text-primary text-h4">{text}</span>
    </div>,
    'inline-flex rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
  );
};
