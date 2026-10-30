'use client';

/**
 * One-component-fits-all "Ask" affordance shared across the three
 * chat-adjacent surfaces (source chips, inline cards, search results).
 *
 * Before this primitive, the same semantic action was implemented three
 * different ways:
 *   - Source chip: inline `<button>` next to the chip
 *   - Source chip dropdown row: secondaryAction icon-button
 *   - Inline card: UI-Kit `<Button variant="transparent">Ask</Button>`
 *   - Search results: nothing (asymmetric — no Ask)
 *
 * Three icon sizes, three different opacity rules, three different DOM
 * shapes for the same action. Centralized here as a single `Button`-
 * backed wrapper so the DOM + a11y + hover behavior live in one place.
 * The `density` prop picks the visual variant; the icon/label/click
 * semantics are identical across all three.
 */

import { MessageSquare, FileText } from 'lucide-react';
import type React from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';
import { TextHold } from '../ui/layout-hold';
import { useLoadingScope } from '../ui/loading-scope';
import { SKELETON_SURFACE_CLASS } from '../ui/skeleton-surface';
import type { ChatRef } from './chat-ref.types';

export type SourceActionDensity = 'inline' | 'card' | 'list-row';

export interface SourceActionButtonProps {
  /** The row to drill into when clicked. The button is HIDDEN when this
   *  is null (e.g. row has no primary key — Ask can't fire). */
  chatRef: ChatRef | null;
  /** Click handler. Receives the chatRef. When undefined the button is
   *  hidden — same as null chatRef. */
  onDiscuss?: (ref: ChatRef) => void;
  /** Visual density / layout. Defaults to `'inline'`. */
  density?: SourceActionDensity;
  /** Optional className appended to the outer element. */
  className?: string;
  /** Button text label override. Defaults to `'Ask'`. The Display variant
   *  on inline cards passes `'Display'` here. Density `'inline'` shows
   *  the icon only — the label is used for aria-label / title even when
   *  it doesn't render visibly. */
  label?: string;
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
  chatRef,
  onDiscuss,
  density = 'inline',
  className,
  label = 'Ask',
  loading,
}: SourceActionButtonProps): React.ReactElement | null {
  if (!chatRef || !onDiscuss) return null;

  // Label-driven icon. "Display" reads as a verbatim-content action so a
  // FileText icon reinforces "show me the body" semantics; the default
  // "Ask" stays MessageSquare for the conversational connotation. Any
  // future label adds an entry to this map.
  const isDisplay = label === 'Display';
  const verbLabel = isDisplay ? `Display ${chatRef.title || 'this item'}` : `Ask about ${chatRef.title || 'this item'}`;
  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDiscuss(chatRef);
  };
  const styles = DENSITY_STYLES[density];
  const IconComponent = isDisplay ? FileText : MessageSquare;
  const icon = <IconComponent className={styles.iconSize} />;

  return (
    <FooterAction
      label={label}
      icon={icon}
      size={styles.size}
      showLabel={styles.showLabel}
      onClick={handle}
      ariaLabel={verbLabel}
      title={verbLabel}
      className={`${styles.className}${className ? ` ${className}` : ''}`}
      loading={loading}
    />
  );
}
