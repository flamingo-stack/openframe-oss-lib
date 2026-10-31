'use client';

import { type ReactNode, useMemo } from 'react';
import { usePageTopicStamp } from '../../contexts/page-topics-context';
import { cn } from '../../utils/cn';
import { AgentMark } from '../agent-mark';
import { EntityIcon } from '../icon-display';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { PageTopicLabel } from '../page-topic-label';
import { useLoadingScope } from '../ui/loading-scope';
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade';
import { QuickActionSet } from './mingo-quick-action-wall';
import { accentFromIdentityIcon, type QuickActionAccent } from './quick-action-chip';

// =============================================================================
// Types
// =============================================================================

/** A guide quick-action chip (e.g. "How to start"). */
export interface GuideQuickAction {
  /** Stable React key. */
  id: string;
  /** Chip label. */
  label: string;
  /** Prompt text seeded into the composer on click. Defaults to `label`. */
  prompt?: string;
  /** Optional library-glyph name (resolved via the onboarding-icon registry). */
  iconName?: string | null;
  /** Optional uploaded image URL (wins over `iconName`). */
  iconUrl?: string | null;
  /** Optional props spread onto the resolved glyph. */
  iconProps?: Record<string, unknown> | null;
  /** Optional agent accent tint for the icon (fae→pink, mingo→cyan). */
  accent?: QuickActionAccent;
}

export interface GuideWelcomeProps {
  /** Greeting heading. Defaults to "Guide Mode Chat". */
  title?: ReactNode;
  /** Optional identity icon (agent mode) — replaces the built-in Mingo mark as
   *  the empty-state glyph. `{ name | url | props }` resolved via <EntityIcon>.
   *  Omitted/empty → the default Mingo mark renders. */
  icon?: { name?: string | null; url?: string | null; props?: Record<string, unknown> | null } | null;
  /** Greeting sub-line. No built-in default — when omitted/empty the sub-line
   *  is not rendered, so the empty state shows only the title. Set via the
   *  admin `emptyStateGreeting` (or a host override). */
  subtitle?: ReactNode;
  /** While the admin greeting is still being fetched, render a one-line
   *  subtitle skeleton instead of flashing empty → text. Ignored once a
   *  `subtitle` is present. A loading scope draws the skeleton too. */
  subtitleLoading?: boolean;
  /** Quick-action chips — caller-provided; there are no built-in defaults, so
   *  the set is omitted entirely unless the host supplies actions. The first
   *  ones fill the set's slots and the rest open from its "More" slot; hover/focus
   *  previews the action's full `prompt` in the composer, click sends it. */
  quickActions?: ReadonlyArray<GuideQuickAction>;
  /** The host is still reading the chips (e.g. the quick actions of the page's
   *  topic): with none to show yet the wall draws its own loading form. A
   *  loading scope draws it too. */
  quickActionsLoading?: boolean;
  /** Print the page's topic (`PageTopicLabel`, the label the FAQ block prints
   *  under its heading) above the chips, so whoever edits quick actions sees
   *  which topic's chips the page asked for. Default: the host's choice
   *  (`PageTopicsProvider showTopic`), else off. */
  showTopic?: boolean;
  /** Fired when a quick-action chip is activated (click). */
  onQuickAction?: (action: GuideQuickAction) => void;
  /** Pointer/keyboard focus enters a quick-action chip — e.g. preview the
   *  action's full `prompt` in the composer input. */
  onQuickActionHover?: (action: GuideQuickAction) => void;
  /** Pointer/keyboard focus leaves the chip — e.g. restore the composer. */
  onQuickActionHoverEnd?: () => void;
  /** Slash-command onboarding list — rendered inside the shared scroll region
   *  below the greeting (so greeting + list scroll together, with edge fades). */
  children?: ReactNode;
  className?: string;
}

// =============================================================================
// Defaults (OpenFrame copy — overridable; the kit stays platform-agnostic)
// =============================================================================

const DEFAULT_TITLE = 'Guide Mode Chat';

// =============================================================================
// Component
// =============================================================================

/**
 * GuideWelcome — Figma node `7532:328214`.
 *
 * Guide-mode chat empty state: a centred greeting and the slash-command
 * onboarding list share one scroll region (with top/bottom fade affordances),
 * and the pinned quick-action set sits above the composer.
 *
 * Mirrors `MingoWelcome` (the default-mode empty state) — content is
 * configurable with OpenFrame defaults.
 */
export function GuideWelcome({
  title = DEFAULT_TITLE,
  icon,
  subtitle,
  subtitleLoading = false,
  quickActions = [],
  quickActionsLoading = false,
  showTopic: showTopicProp,
  onQuickAction,
  onQuickActionHover,
  onQuickActionHoverEnd,
  children,
  className,
}: GuideWelcomeProps) {
  // The host's choice (`PageTopicsProvider showTopic`) unless this surface states its own.
  const topicStamp = usePageTopicStamp();
  const showTopic = showTopicProp ?? topicStamp;
  // Scroll-fade affordances: a 48px gradient at the top/bottom edge of the
  // scroll region, shown only while content is actually hidden in that
  // direction. (Same behaviour as MingoWelcome.)
  const { scrollRef, fadeTop, fadeBottom, update: updateScrollFade } = useScrollFade<HTMLDivElement>();
  // ONE switch for the greeting (read data): a loading scope, or the host still fetching it with none to show yet.
  const inLoadingScope = useLoadingScope();
  const subtitleIsLoading = inLoadingScope || (subtitleLoading && !subtitle);
  // The same switch for the chips (read data): the wall draws its loading form while there are none to show yet.
  const chipsAreLoading = inLoadingScope || (quickActionsLoading && quickActions.length === 0);

  // Map to the shared {@link QuickActionChip} shape the chat's {@link QuickActionSet} draws (the set Mingo's empty
  // state and the OpenFrame dock draw too). `onHoverStart`/`onHoverEnd` drive the composer prompt preview and
  // `onSelect` sends.
  const chipItems = useMemo(
    () =>
      quickActions.map(action => ({
        id: action.id,
        label: action.label,
        // Declarative spec — the unified chip resolves it via <EntityIcon>.
        // Chip icon accent, config first: per-action accent (host/agent
        // resolution) → the admin-configured identity color on this surface's
        // icon (`icon_props.color`) → cyan, the built-in Mingo-guide branding.
        // An admin-set per-action `iconProps.color` still wins over any accent.
        icon: {
          name: action.iconName,
          url: action.iconUrl,
          props: action.iconProps,
          accent: action.accent ?? accentFromIdentityIcon(icon) ?? 'cyan',
        },
        onSelect: () => onQuickAction?.(action),
        onHoverStart: () => onQuickActionHover?.(action),
        onHoverEnd: () => onQuickActionHoverEnd?.(),
      })),
    [quickActions, icon, onQuickAction, onQuickActionHover, onQuickActionHoverEnd],
  );

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)]', className)}>
      {/* Greeting + slash-command list share one scroll region; `relative` so
          the edge fades can overlay it. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={updateScrollFade}
          className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)] overflow-y-auto overscroll-contain"
        >
          {/* Greeting grows to fill (`flex-1`) so the slash-command list stays
              anchored below it — but its content is anchored at the TOP of the
              grown block (no `justify-center`). Vertical-centering the content
              would re-position the icon/title every time the children's height
              changed (e.g. the chip-catalog skeleton → real cards swap: the
              skeleton renders a fixed 6 rows but the resolved list is whatever
              the admin configured — 14 on the hub today). Whichever direction
              the delta runs, a centered greeting jumps by half the delta on
              load. Top-anchoring keeps the icon and title at the same
              scroll-viewport-top position regardless of the list height
              beneath them. */}
          <div className="flex flex-1 flex-col items-center gap-[var(--spacing-system-l)] px-[var(--spacing-system-l)] py-[var(--spacing-system-xxl)] text-center">
            {icon && (icon.name || icon.url) ? (
              // Agent-mode identity glyph (chat-config Identity tab). Sized to
              // match the default Mingo mark (48px).
              <EntityIcon icon={{ name: icon.name, url: icon.url, props: icon.props }} size={48} />
            ) : (
              <AgentMark agent="mingo" className="h-12 w-12" />
            )}
            <div className="flex w-full flex-col gap-[var(--spacing-system-l)]">
              <p className="text-ods-text-primary text-h2">{title}</p>
              {/* Sub-line: while the greeting is still being fetched show a
                  one-line skeleton; once settled, render the greeting (admin
                  copy / host override) or nothing — no built-in default, so by
                  default the empty state shows the title alone. */}
              {subtitleIsLoading ? (
                <div className="flex w-full justify-center">
                  <TextLineSkeleton type="h4" className="w-3/4 max-w-80" />
                </div>
              ) : subtitle ? (
                <p className="text-ods-text-secondary text-h4">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {children}
        </div>

        {/* Edge scroll-fades — visible only when content is hidden beyond them. */}
        <ScrollFadeOverlay edge="top" visible={fadeTop} className="h-12" />
        <ScrollFadeOverlay edge="bottom" visible={fadeBottom} className="h-12" />
      </div>

      {/* The quick actions, pinned above the composer: the static {@link QuickActionSet} (fixed slots, its height
          set by the width alone, "More" for the rest). Hover/focus previews the action's full prompt in the
          composer, click sends it. */}
      {/* Right-aligned and pulled against the chips, so it reads as a stamp on the wall, not a row of its own. */}
      {showTopic && (
        <PageTopicLabel className="-mb-[var(--spacing-system-xs)] shrink-0 px-[var(--spacing-system-l)] text-right" />
      )}
      {(quickActions.length > 0 || chipsAreLoading) && <QuickActionSet chips={chipItems} loading={chipsAreLoading} />}
    </div>
  );
}
