'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { MingoIcon } from '../icons'
import { MingoChatHistorySkeleton } from './mingo-chat-history'
import { ChatQuickActionRow } from './chat-quick-action-row'
import { QuickActionChipButton } from './quick-action-chip'
import { Button } from '../ui/button'
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import {
  Rocket01Icon,
  BracketCurlyIcon,
  SearchIcon,
  LayersIcon,
  CompassIcon,
  Arrow01DownIcon,
  AlertCircleIcon,
  Refresh01RightIcon,
} from '../icons-v2-generated'

// =============================================================================
// Types
// =============================================================================

/** A single capability cell in the 2-up feature grid. */
export interface MingoFeatureCard {
  /** Stable React key. */
  id: string
  /** Leading 16×16 icon (monochrome `ods-text-secondary`). */
  icon?: React.ReactNode
  /** Caption text. Line breaks (`\n`) are honoured (`whitespace-pre-line`)
   *  so the two-line wrap stays fixed regardless of panel width. */
  text: React.ReactNode
}

/** "New to OpenFrame?" one-time notification config. `null` hides the card. */
export interface MingoWelcomePromo {
  title: React.ReactNode
  description: React.ReactNode
}

/** Extra quick-action chip rendered after the built-in "Start Guide Chat". */
export interface MingoQuickAction {
  /** Stable React key. */
  id: string
  label: string
  icon?: React.ReactNode
  /** `'primary'` = accent (yellow) chip, `'outline'` = bordered chip. */
  variant?: 'primary' | 'outline'
  onClick?: () => void
  /** Full prompt text previewed as ghost text in the composer on hover/focus.
   *  The chip `label` is short; this reveals what the action will actually ask.
   *  Omitted → falls back to `label`. */
  prompt?: string
}

export interface MingoWelcomeProps {
  /** First name woven into the greeting. Empty/undefined → no-name variant. */
  userName?: string
  /** Greeting heading. Defaults to `Hey{, name}, I'm Mingo`. */
  title?: React.ReactNode
  /** Greeting sub-line under the heading. */
  subtitle?: React.ReactNode
  /** 2-up capability grid. Defaults to the four OpenFrame highlights. */
  featureCards?: ReadonlyArray<MingoFeatureCard>
  /** One-time "New to OpenFrame?" notification below the grid. `null` hides
   *  it; omitting falls back to the OpenFrame default (only rendered when
   *  `onStartGuideChat` is wired, i.e. Guide mode exists to advertise). */
  promo?: MingoWelcomePromo | null
  /** Storage key used to remember the promo dismissal. */
  promoStorageKey?: string
  /** Where the dismissal is persisted. `'local'` (default) survives across
   *  sessions; `'session'` clears when the tab closes. */
  promoStorage?: 'local' | 'session'
  /** Extra quick-action chips appended after the "Start Guide Chat" chip. */
  quickActions?: ReadonlyArray<MingoQuickAction>
  /** Pointer/keyboard focus enters a quick-action chip — e.g. preview the
   *  action's full `prompt` in the composer input. */
  onQuickActionHover?: (action: MingoQuickAction) => void
  /** Pointer/keyboard focus leaves the chip — e.g. restore the composer. */
  onQuickActionHoverEnd?: () => void
  /** Returning-user variation: the user already has chats. Hides the
   *  "New to OpenFrame?" notification entirely and renders the "Start Guide
   *  Chat" chip in the muted `outline` style instead of the accent yellow. */
  hasExistingChats?: boolean
  /** Returning-user main content — when provided (typically a
   *  `<MingoChatHistory>`), it replaces the greeting + feature grid and owns
   *  its own scroll region. The chips below stay pinned. */
  dialogHistory?: React.ReactNode
  /** True while the FIRST page of dialogs is still loading and we don't yet
   *  know if the user is new or returning. Renders a history skeleton in place
   *  of both the greeting+grid and the history, so the empty state doesn't
   *  flash the new-user layout before the list arrives. Ignored once
   *  `dialogHistory` is provided. */
  isLoadingHistory?: boolean
  /** The dialog-list load FAILED (e.g. backend down) and there's nothing
   *  cached. Renders an error + retry block in place of the new-user empty
   *  state (which would otherwise misleadingly advertise Guide). Takes
   *  priority over `isLoadingHistory`. Ignored once `dialogHistory` is set. */
  loadError?: boolean
  /** Retry handler for the `loadError` state. */
  onRetry?: () => void
  /** Whether the dialog history has a search bar — when true, the loading
   *  skeleton includes a search-bar placeholder so it matches the loaded
   *  layout. Ignored once `dialogHistory` is provided. */
  historySearchable?: boolean
  /** When provided, renders the "Start Guide Chat" chip (the only wired
   *  action — switches the host chat to Guide mode) and enables the default
   *  promo notification. When omitted, both are suppressed. */
  onStartGuideChat?: () => void
  /** Appended to the root element. */
  className?: string
}

// =============================================================================
// Defaults (OpenFrame copy — overridable per Core Rule: platform-agnostic kit)
// =============================================================================

const DEFAULT_SUBTITLE =
  'Ready to help with your technical tasks. What can I do for you?'

const DEFAULT_FEATURE_CARDS: ReadonlyArray<MingoFeatureCard> = [
  {
    id: 'answers',
    icon: <Rocket01Icon size={16} />,
    text: 'Get instant answers about\ndevices, tickets, and clients',
  },
  {
    id: 'scripts',
    icon: <BracketCurlyIcon size={16} />,
    text: 'Run scripts and queries\nthrough natural language',
  },
  {
    id: 'summarize',
    icon: <SearchIcon size={16} />,
    text: 'Summarize long ticket\nthreads or activity history',
  },
  {
    id: 'delegate',
    icon: <LayersIcon size={16} />,
    text: 'Delegate tasks, let Mingo\nwork in the background',
  },
]

const DEFAULT_PROMO: MingoWelcomePromo = {
  title: 'New to OpenFrame?',
  description: 'Start a Guide Chat to learn how it works and how to set it up.',
}

const DEFAULT_PROMO_STORAGE_KEY = 'mingo-welcome:promo-dismissed'

// =============================================================================
// Component
// =============================================================================

/**
 * MingoWelcome — Figma node `7532:222444`.
 *
 * Default (Mingo-mode) chat empty state: a vertically-centred greeting that
 * grows to fill available height, then a pinned stack of a 2-up capability
 * grid, an optional one-time "New to OpenFrame?" notification, and a
 * quick-action chip row. The Guide-mode empty state keeps the slash-command
 * onboarding list.
 *
 * Content is configurable (props) with OpenFrame defaults so the kit stays
 * platform-agnostic. The "Start Guide Chat" chip is the only wired action —
 * it switches the host chat to Guide mode via `onStartGuideChat`. The
 * notification carries no action; its dismiss "X" persists to local/session
 * storage so it shows only until the user closes it once.
 */
export function MingoWelcome({
  userName,
  title,
  subtitle = DEFAULT_SUBTITLE,
  featureCards = DEFAULT_FEATURE_CARDS,
  promo,
  promoStorageKey = DEFAULT_PROMO_STORAGE_KEY,
  promoStorage = 'local',
  quickActions,
  onQuickActionHover,
  onQuickActionHoverEnd,
  hasExistingChats = false,
  dialogHistory,
  isLoadingHistory = false,
  loadError = false,
  onRetry,
  historySearchable = false,
  onStartGuideChat,
  className,
}: MingoWelcomeProps) {
  const heading =
    title ?? (userName ? `Hey ${userName}, I'm Mingo` : "Hey, I'm Mingo")

  // `promo` omitted → fall back to the OpenFrame default, but only when guide
  // mode exists to advertise (otherwise the notification points nowhere).
  // Returning users (`hasExistingChats`) never see the onboarding notification.
  const resolvedPromo = hasExistingChats
    ? null
    : promo === undefined
      ? onStartGuideChat
        ? DEFAULT_PROMO
        : null
      : promo

  // One-time notification: hydrate the dismissal from storage after mount
  // (SSR-safe — `window` is untouched on the server). Default to "not
  // dismissed" so the first paint shows it, then hide if storage says so.
  const [promoDismissed, setPromoDismissed] = React.useState(false)
  React.useEffect(() => {
    if (!resolvedPromo) return
    try {
      const store =
        promoStorage === 'session' ? window.sessionStorage : window.localStorage
      if (store.getItem(promoStorageKey) === '1') setPromoDismissed(true)
    } catch {
      // Storage can throw (private mode, blocked cookies) — treat as
      // "not dismissed" and simply keep showing the notification.
    }
  }, [resolvedPromo, promoStorage, promoStorageKey])

  const dismissPromo = React.useCallback(() => {
    setPromoDismissed(true)
    try {
      const store =
        promoStorage === 'session' ? window.sessionStorage : window.localStorage
      store.setItem(promoStorageKey, '1')
    } catch {
      // Best-effort persistence; the in-memory state still hides it for
      // the rest of this session.
    }
  }, [promoStorage, promoStorageKey])

  // Scroll-fade affordances — shared ui/scroll-fade (48px edge gradients shown
  // only while content is hidden in that direction).
  const { scrollRef, fadeTop, fadeBottom, update: updateScrollFade } = useScrollFade<HTMLDivElement>()

  const cellCount = featureCards.length
  // Last row's first index — used to drop the bottom divider on the final row.
  const lastRowStart = cellCount - ((cellCount % 2) || 2)

  // While we don't yet know whether the user is new or returning (first page
  // loading, or it errored with nothing cached), suppress the pinned region —
  // the "New to OpenFrame?" promo + quick-action chips. Showing them over the
  // history skeleton both clutters the loading frame and pre-judges the user as
  // new. They return once a resolved state (history, or the new-user greeting)
  // renders. `dialogHistory` always wins — a returning user keeps the chips.
  const showPinnedRegion = !!dialogHistory || (!isLoadingHistory && !loadError)

  return (
    <div
      className={cn(
        // `@container` makes the panel itself the responsive context (the
        // drawer width ≠ viewport width) so the notification's down-arrow can
        // appear only once the panel is genuinely wide.
        '@container flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)]',
        className,
      )}
    >
      {/* Returning users see their dialog history (its own scroll region) in
          place of the greeting + grid. Precedence: load error (retry) → first-
          page loading (skeleton) → new-user greeting+grid. The error branch
          stops a failed fetch from masquerading as "no chats" (which would
          otherwise show the Guide promo). */}
      {dialogHistory ?? (loadError ? (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-[var(--spacing-system-m)] text-center">
          <AlertCircleIcon className="h-8 w-8 text-ods-text-secondary shrink-0" />
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <p className="text-h4 text-ods-text-primary">Couldn’t load your chats</p>
            <p className="text-body-sm text-ods-text-secondary">
              Something went wrong reaching the server. Check your connection and try again.
            </p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="small"
              leftIcon={<Refresh01RightIcon />}
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      ) : isLoadingHistory ? (
        <MingoChatHistorySkeleton searchable={historySearchable} />
      ) : (
      <>
      {/* Scrollable region — only the greeting + grid scroll; the notification
          and chips below stay pinned so they're always visible above the
          input. The wrapper is `relative` so the scroll-fade gradients can
          overlay the top/bottom edges. */}
      <div className="relative flex flex-1 min-h-0 flex-col">
      <div
        ref={scrollRef}
        onScroll={updateScrollFade}
        className="flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-y-auto"
      >
        {/* Greeting — grows to fill (`flex-1`) so it centres vertically,
            keeping the grid anchored at the bottom of the scroll area. Default
            `min-height: auto` (no `min-h-0`) stops it shrinking below its own
            content, so the region scrolls instead of the greeting overlapping
            the grid. Padding is modest so it never dominates the narrow panel. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-l)] px-[var(--spacing-system-l)] py-[var(--spacing-system-xxl)] text-center">
        <MingoIcon
          className="h-12 w-12"
          color="white"
          eyesColor="var(--ods-flamingo-cyan-base)"
          cornerColor="var(--ods-flamingo-cyan-base)"
        />
        <div className="flex w-full flex-col gap-1">
          <p className="text-h4 text-ods-text-primary">{heading}</p>
          <p className="text-h6 text-ods-text-secondary">{subtitle}</p>
        </div>
      </div>

      {/* 2-up capability grid. `shrink-0` keeps every cell at its natural
          height so the bottom row is never clipped (the root scrolls instead).
          Cells share the lighter `ods-card` surface; 1px `ods-border` dividers
          (right on the left column, bottom on every row but the last) draw the
          inner cross. Captions use explicit `\n` breaks (`whitespace-pre-line`)
          so the two-line wrap is fixed and never reflows with panel width. */}
      {cellCount > 0 && (
        <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ods-border bg-ods-card">
          {featureCards.map((card, i) => (
            <div
              key={card.id}
              className={cn(
                'flex flex-col items-center justify-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] text-center',
                i % 2 === 0 && 'border-r border-ods-border',
                i < lastRowStart && 'border-b border-ods-border',
              )}
            >
              {card.icon ? (
                <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-primary">
                  {card.icon}
                </span>
              ) : null}
              <p className="text-h4 text-ods-text-secondary whitespace-pre-line">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Edge scroll-fades — visible only when content is hidden beyond them. */}
      <ScrollFadeOverlay edge="top" visible={fadeTop} color="var(--color-bg-card)" className="h-12" />
      <ScrollFadeOverlay edge="bottom" visible={fadeBottom} color="var(--color-bg-card)" className="h-12" />
      </div>
      </>
      ))}

      {/* Pinned region — visible above the input once the new/returning-user
          state is known (hidden during first-page load / error). */}
      {showPinnedRegion && (
      <div className="flex shrink-0 flex-col gap-[var(--spacing-system-m)]">
      {/* "New to OpenFrame?" — a one-time informational notification (no
          action). The leading down-arrow (Figma node 7532:317130) only shows
          once the panel is wide (`@2xl`), mirroring the responsive design. The
          dismiss "X" persists to local/session storage via `dismissPromo`, so
          once closed it stays hidden. The actual Guide entry point is the
          "Start Guide Chat" chip below. */}
      {resolvedPromo && !promoDismissed && (
        <div className="relative shrink-0 flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-m)] pr-[var(--spacing-system-xl)]">
          <span className="hidden @2xl:flex size-4 shrink-0 items-center justify-center text-ods-text-primary">
            <Arrow01DownIcon size={16} />
          </span>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="text-h3 text-ods-text-primary">
              {resolvedPromo.title}
            </span>
            <span className="text-h6 text-ods-text-secondary">
              {resolvedPromo.description}
            </span>
          </div>
          {/* Plain cross — no button chrome, just a clickable icon. */}
          <button
            type="button"
            onClick={dismissPromo}
            aria-label="Dismiss"
            className="absolute right-2 top-2 text-ods-text-secondary transition-colors hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent rounded-sm"
          >
            <XmarkIcon size={16} />
          </button>
        </div>
      )}

      {/* Quick-action chips. "Start Guide Chat" stays pinned (the `leading`
          slot — never collapses); any caller `quickActions` fit inline and the
          rest collapse under a "⋯" overflow menu, width-measured like the
          Autocomplete tag row. */}
      {(onStartGuideChat || (quickActions && quickActions.length > 0)) && (
        <ChatQuickActionRow
          leading={
            onStartGuideChat && (
              <QuickActionChipButton
                label="Start Guide Chat"
                icon={<CompassIcon size={16} />}
                variant={hasExistingChats ? 'outline' : 'primary'}
                onSelect={onStartGuideChat}
              />
            )
          }
          chips={(quickActions ?? []).map((action) => ({
            id: action.id,
            label: action.label,
            icon: action.icon,
            variant: action.variant,
            onSelect: action.onClick,
            onHoverStart: () => onQuickActionHover?.(action),
            onHoverEnd: () => onQuickActionHoverEnd?.(),
          }))}
        />
      )}
      </div>
      )}
    </div>
  )
}
