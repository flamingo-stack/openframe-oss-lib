'use client';

/**
 * A record's "Ask Mingo" (or "Display") as a button, for the surfaces that show it beside the record rather than in its
 * "⋯" menu: the footer of a card and a row of the sources strip. It draws the action it is given, never decides it:
 * the action, its label and its icon come from `recordDiscussAction` (entity-cards/dispatch.tsx), the same that builds
 * the record's menu row, so the button and the menu can never offer different things. The `density` picks the look.
 */

import type React from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';
import { TextHold } from '../ui/layout-hold';
import { useLoadingScope } from '../ui/loading-scope';
import { SKELETON_SURFACE_CLASS } from '../ui/skeleton-surface';

/** A record's "Ask Mingo"/"Display" action (`recordDiscussAction`), the same for its card, its chip and its row. */
export interface CardDiscussAction {
  label: string;
  icon: React.ReactNode;
  run: () => void;
  /** Held while a turn runs: the row keeps its place, and the "⋯" that may hold nothing else stays. */
  disabled?: boolean;
}

export type SourceActionDensity = 'inline' | 'card' | 'list-row';

export interface SourceActionButtonProps {
  /** The record's action (`recordDiscussAction`); none draws nothing. */
  action: CardDiscussAction | undefined;
  /** The record's name, for the button's accessible name. */
  title: string;
  /** Visual density / layout. Defaults to `'inline'`. */
  density?: SourceActionDensity;
  /** Optional className appended to the outer element. */
  className?: string;
  /** Draw the action's loading form: the same box, its icon and label as skeleton bars. */
  loading?: boolean;
}

/** A chat card's footer action (Ask, Display, Watch video): one look for every action in that row. */
export const CARD_FOOTER_ACTION_CLASS =
  '!h-auto !p-0 text-h6 font-normal text-ods-text-secondary opacity-60 hover:bg-transparent hover:opacity-100 hover:text-ods-text-primary';

// Per-density styling lives in one map so the three call sites share the
// SAME hover/opacity/transition rules. Adding a fourth density means
// adding one entry here, not touching the render path.
const DENSITY_STYLES: Record<
  SourceActionDensity,
  {
    size: 'small' | 'icon';
    showLabel: boolean;
    iconSize: string;
    className: string;
  }
> = {
  inline: {
    size: 'icon',
    showLabel: false,
    iconSize: '!h-3 !w-3',
    className:
      '!h-5 !w-5 !p-0 text-ods-text-secondary opacity-60 hover:opacity-100 hover:text-ods-text-primary hover:bg-ods-accent/15',
  },
  card: {
    size: 'small',
    showLabel: true,
    iconSize: '!h-3 !w-3',
    className: CARD_FOOTER_ACTION_CLASS,
  },
  'list-row': {
    size: 'small',
    showLabel: true,
    iconSize: '!h-3 !w-3',
    className:
      '!h-auto !px-1.5 !py-0.5 text-h6 font-normal text-ods-text-secondary opacity-60 hover:opacity-100 hover:text-ods-text-primary hover:bg-ods-accent/10',
  },
};

/**
 * A card footer's action: a small transparent button with an icon (and a trailing icon when it opens something below
 * the card) and its label, or the icon alone when `showLabel` is off. Its loading form is the same button, inert and
 * unread, with the icons and the label drawn as skeleton bars, so the box is exactly the loaded action's. THE one
 * footer action: the Ask action and a card's "Watch video" both draw it.
 */
export function FooterAction({
  label,
  icon,
  trailingIcon,
  className,
  showLabel = true,
  size = 'small',
  onClick,
  ariaLabel,
  ariaExpanded,
  title,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  trailingIcon?: React.ReactNode;
  className: string;
  showLabel?: boolean;
  size?: 'small' | 'icon';
  onClick?: (event: React.MouseEvent) => void;
  ariaLabel?: string;
  ariaExpanded?: boolean;
  title?: string;
  loading?: boolean;
}): React.ReactElement {
  if (useLoadingScope() || loading) {
    const mark = <span className={cn(SKELETON_SURFACE_CLASS, 'inline-block h-3 w-3 rounded-sm')} />;
    return (
      <span aria-hidden inert className="contents">
        <Button
          variant="transparent"
          size={size}
          tabIndex={-1}
          leftIcon={showLabel ? mark : undefined}
          rightIcon={trailingIcon ? mark : undefined}
          className={cn(className, 'pointer-events-none')}
        >
          {showLabel ? <TextHold>{label}</TextHold> : mark}
        </Button>
      </span>
    );
  }
  return (
    <Button
      variant="transparent"
      size={size}
      leftIcon={showLabel ? icon : undefined}
      rightIcon={trailingIcon}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      title={title}
      className={className}
    >
      {showLabel ? label : icon}
    </Button>
  );
}

export function SourceActionButton({
  action,
  title,
  density = 'inline',
  className,
  loading,
}: SourceActionButtonProps): React.ReactElement | null {
  if (!action) return null;
  const verbLabel = `${action.label}: ${title || 'this item'}`;
  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!action.disabled) action.run();
  };
  const styles = DENSITY_STYLES[density];
  return (
    <FooterAction
      label={action.label}
      icon={<span className={cn('inline-flex [&>*]:!size-full', styles.iconSize)}>{action.icon}</span>}
      size={styles.size}
      showLabel={styles.showLabel}
      onClick={handle}
      ariaLabel={verbLabel}
      title={verbLabel}
      className={`${styles.className}${action.disabled ? 'pointer-events-none opacity-40' : ''}${className ? ` ${className}` : ''}`}
      loading={loading}
    />
  );
}
