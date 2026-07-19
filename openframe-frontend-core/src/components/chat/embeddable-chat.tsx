'use client'

/**
 * EmbeddableChat — lib-portable port of the hub's `<GlobalAskAI>` component.
 *
 * Drops every hub-only import (auth-provider, useNavLink, currentPlatform,
 * tableIdForDocumentType, rag-table-config, etc.) and routes ALL navigation
 * + identity decisions through `useRequiredChatRuntime()`. Host wires the
 * runtime once at root (HubRuntimeProvider in the hub, custom provider in
 * embedders); this component reads from it everywhere.
 *
 * Diff summary vs hub original:
 *   - `useAuth()` → `useRequiredChatRuntime().user` (greeting + identity only;
 *     the requireAuth render gate is dropped — hub's wrapper handles it).
 *   - `currentPlatform()` → `useRequiredChatRuntime().source`.
 *   - `useNavLink`/`NavLinkAnchor` → chip-anchor rewrite via
 *     `handleChatNavClick` + lib's `NavLinkAnchorViaRuntime`.
 *   - `useDocChat(source)` → `useSseChatAdapter()` (reads source from runtime).
 *   - `tableIdForDocumentType` import deleted (dead per audit).
 *   - `renderChatInlineEntityCard` imported from lib's entity-cards barrel.
 *   - `useCloseOnNavigation` signature is `(close, pathname)` — pass `null`
 *     because lib has no `usePathname()` and embedders own that decision.
 *   - All other hub utilities (chat-attachment-bar, slash-commands fetcher,
 *     icon registry, chip-styles, click-utils, etc.) re-resolved against
 *     the equivalent lib modules.
 *
 * Public surface — `<EmbeddableChat />` taking the same prop bundle the hub
 * shell passes (minus `requireAuth`, which the hub's wrapper handles), plus
 * an optional `extras` opt-in for the chat-card dispatch helpers that need
 * host-supplied builders (program configs, product-release prop builder).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { usePreventScroll } from '@react-aria/overlays'
import { isIOS } from '@react-aria/utils'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { FileText, MessageSquare } from 'lucide-react'

import { Button } from '../ui/button'
import { Drawer, DrawerContent } from '../ui/drawer'
import { HoverDropdown, type HoverDropdownItem } from '../ui/hover-dropdown'
import { MingoIcon } from '../icons'
import { EntityIcon } from '../icon-display'

import { MingoOnboardingCard } from './mingo-onboarding-card'
import { MingoOnboardingCardSkeleton } from './mingo-onboarding-card-skeleton'
import { MingoWelcome, type MingoWelcomeProps } from './mingo-welcome'
import { MingoHistoryRail } from './mingo-history-rail'
import { GuideWelcome, type GuideWelcomeProps } from './guide-welcome'
import { accentFromIdentityIcon, getAgentAccent } from './quick-action-chip'
import { GuideModeBanner } from './guide-mode-banner'
import { PortalContainerContext } from '../ui/portal-container'
import { ChatPanelHeader, type ChatPanelHeaderProps } from './chat-panel-header'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { ChatHeaderSearchField } from './chat-header-search-field'
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu'
import { Arrow02RightIcon, Arrow02LeftIcon, SearchIcon, ClockHistoryIcon, Ellipsis01Icon, Refresh01LeftIcon } from '../icons-v2-generated'
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatArchivePage } from './chat-archive-page'
import { ChatComposer } from './chat-composer'
import { useChatDialogManager } from './hooks/use-chat-dialog-manager'
import { ChatDialogModals } from './mingo-chat-modals'
import { ChatMessageList } from './chat-message-list'
import { ChatMessageListSkeleton } from './chat-message-skeleton'
import { SourceActionButton } from './source-action-button'
import { NavLinkAnchorViaRuntime } from './nav-link-anchor-via-runtime'
import { ChatAttachmentChipStrip } from './chat-attachment-bar'
import { renderChatInlineEntityCard } from './entity-cards/dispatch'
import type { ChatCardDispatchExtras } from './entity-cards/dispatch'

import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context'
import { useRouter } from '../../embed-shims/next-navigation'
import { type ChatSource, type UseSseChatAdapterOptions } from './hooks/use-sse-chat-adapter'
import {
  useUnifiedChat,
  type ChatMode,
  type UseUnifiedChatModes,
} from './hooks/use-unified-chat'
import type { UnifiedChatState } from './types/unified-chat-state.types'
import type {
  UseNatsChatAdapterConfig,
  FetchDialogsParams,
  FetchDialogsResult,
} from './hooks/use-nats-chat-adapter'
import { useChatAttachments } from './hooks/use-chat-attachments'
import { useChatAttachmentImageGallery } from './hooks/use-chat-attachment-image-gallery'
import { useChatIdentity } from './hooks/use-chat-identity'
import { useCloseOnNavigation } from './hooks/use-close-on-navigation'
import { fetchSlashCommands, useSlashCommandRegistry, type SlashCommandSummary } from './hooks/use-slash-commands'
import { useEmptyStateConfig } from './hooks/use-empty-state-config'

import type { ChatRef } from './chat-ref.types'
import type { ChatInputRef, SlashCommandActionId } from './types/component.types'
import type { Message } from './types/message.types'
import type {
  ChatContextItem,
  ChatContextPickerConfig,
} from './types/context-item.types'

import { formatChatAttachmentMarkdownForBubble } from './utils/chat-attachment-markdown'
import { handleChatNavClick } from './utils/nav-click-handler'
import { computeIsNewTab, newTabAnchorAttrs } from './utils/nav-anchor-props'
import { resolveHrefForRuntime } from './utils/chat-nav-resolution'
import { ChatPanelContext, type ChatPanelHandle } from './chat-panel-context'
import { resolveSourceRowCTA, sourceRowCtxFromRuntime } from './utils/source-row-cta'
import { chatChipClass } from './utils/chip-styles'
import { resolveIcon } from './utils/icon-library'
import { getSourceIconName } from './utils/source-icons'
import { formatSingularLookupInvocation } from './utils/slash-dispatch-utils'

// Desktop drawer opens at this fraction of the viewport width (clamped to the
// Drawer's own min/max). The user can still resize (persisted per DRAWER_WIDTH_KEY).
const DRAWER_DEFAULT_WIDTH_RATIO = 0.5
// Bump the suffix whenever the default policy changes so previously-persisted
// widths (e.g. the old fixed 750px / earlier 30% default) reset on next open.
const DRAWER_WIDTH_KEY = 'mingo-chat-width-v3'
const DRAWER_DEFAULT_WIDTH_PX = 750 // SSR fallback before the viewport is known
function drawerDefaultWidth(): number {
  if (typeof window === 'undefined') return DRAWER_DEFAULT_WIDTH_PX
  return Math.round(window.innerWidth * DRAWER_DEFAULT_WIDTH_RATIO)
}


// =============================================================================
// Types
// =============================================================================

/** Lib-side type alias kept inline to avoid leaking the (deprecated) hub
 *  `rag-table-config` `DocSource` import. The chat source is always a
 *  string id; `useSseChatAdapter` reads it from `runtime.source`. */
type DocSource = string

export interface EmbeddableChatProps {
  /** Base route for in-app doc chip nav (e.g. `/knowledge-base`). When
   *  omitted, defaults are derived from `runtime.source`. */
  baseRoute?: string
  /** When the embedder doesn't host a `[...path]` route to render markdown
   *  chips against, set this to a platform that does. Chips with
   *  `externalUrl: null` resolve to `getBaseUrl(chipBasePlatform) +
   *  '/knowledge-base/' + path` and open in a new tab. */
  chipBasePlatform?: string
  /** DB-driven list of enabled RAG table ids (chip catalog filter).
   *  Prefetched server-side by the embedder's wrapper. Empty/null → no
   *  empty-state chips render. */
  enabledRagTableIds?: ReadonlyArray<string> | null
  /** DB-backed empty-state greeting. Falls back to a generic greeting. */
  emptyStateGreeting?: string | null
  /** DB-backed starter prompts (chips below the greeting). */
  suggestedQueries?: ReadonlyArray<string> | null
  /** Controlled-mode open state. When provided, `onOpenChange` MUST also
   *  be provided. Uncontrolled mode is the default. */
  open?: boolean
  /** Controlled-mode change handler. Required when `open` is provided. */
  onOpenChange?: (open: boolean) => void
  /** Initial open state for uncontrolled mode. Ignored if `open` is set. */
  defaultOpen?: boolean
  /** Render the built-in floating "Ask AI" trigger. Defaults to `true`. */
  showInternalTrigger?: boolean
  /**
   * Non-interactive display mode. When `true`, the whole panel becomes a
   * static visual — every hover state and click is blocked (via
   * `pointer-events-none` on the panel body) and the composer no longer
   * auto-focuses. Use it to embed the chat as a marketing/hero mock (e.g. a
   * scripted `mingoState` thread) that should look live but not respond to the
   * cursor. Scrolling is intentionally disabled too. Defaults to `false`.
   */
  previewMode?: boolean
  /** Optional builders for chat-card types whose props live in hub-land
   *  (programs + product_release). Forwarded straight to
   *  `renderChatInlineEntityCard`. */
  extras?: ChatCardDispatchExtras
  /** Optional callback used by `useSseChatAdapter`'s `displayRef` /
   *  `discussRef` flow to translate an LLM document type into the
   *  registry table id for entity-id-filtered retrieval.
   *
   *  Legacy top-level form. The new shape is `modes.guide.tableIdForDocumentType`.
   *  When both are present, `modes` wins. */
  tableIdForDocumentType?: (documentType: string) => string | null

  /**
   * Per-mode transport configuration. When omitted, the component
   * falls back to legacy guide-only behaviour synthesised from the
   * top-level `tableIdForDocumentType` prop — multi-platform-hub and
   * any other existing consumer keep working with zero changes.
   *
   * When provided, this is the canonical way to wire chat transports:
   *
   *   - `modes.guide`  → SSE/Guide adapter options (RAG retrieval, hub).
   *   - `modes.mingo`  → NATS/Mingo adapter config  (agent, openframe).
   *
   * Configuring both modes makes the in-panel mode toggle appear so
   * the user can flip between Guide and Mingo without losing either
   * history (each mode keeps its own local thread).
   */
  modes?: UseUnifiedChatModes

  /**
   * Pre-built Mingo-mode state, supplied by the host instead of letting the
   * built-in NATS adapter own it. When provided, the panel renders Mingo mode
   * from this object and opens no subscription of its own — the host keeps
   * chat data + streaming in its own store/cache so it survives the panel
   * unmounting (no `keepMounted` needed). The host should then NOT pass
   * `modes.mingo` (Guide-mode wiring via `modes.guide` is unaffected).
   */
  mingoState?: UnifiedChatState

  /**
   * Dialog-management capabilities for injected Mingo mode (`mingoState`).
   *
   * When the host injects `mingoState`, it doesn't pass `modes.mingo` (that
   * would re-activate the idle built-in adapter), so the rename/archive/
   * restore/archive-page affordances can't read their capability flags off the
   * callback config. Supply them here instead. `canRename`/`canArchive` default
   * to `true` when `mingoState` is set; the archive page + restore are shown
   * only when their callbacks are provided. Ignored unless `mingoState` is set.
   */
  mingoDialogCapabilities?: {
    canRename?: boolean
    canArchive?: boolean
    fetchArchivedDialogs?: (
      params: FetchDialogsParams,
    ) => Promise<FetchDialogsResult>
    unarchiveDialog?: (id: string) => Promise<void>
    searchQuery?: string
    onSearchChange?: (query: string) => void
  }

  /**
   * Controlled active-mode. When provided, `onActiveModeChange` MUST
   * also be provided. For uncontrolled use see `defaultActiveMode`.
   */
  activeMode?: ChatMode

  /** Controlled active-mode change handler. Required when `activeMode` is set. */
  onActiveModeChange?: (mode: ChatMode) => void

  /**
   * OpenFrame AI agent mode — render a global agent (e.g. `'fae'`, `'mingo'`).
   * Works in BOTH regular (host) AND embedded modes. When set, the chat fetches
   * that agent's display config (greeting + suggested prompts) instead of the
   * platform empty-state — the "agent mode" URL override. DISPLAY-only this
   * phase: retrieval still resolves server-side from the platform. Optional;
   * unset = today's behavior.
   *
   * Route resolution (highest → lowest precedence):
   *   1. `aiAgentConfigUrl` prop (below)
   *   2. `runtime.endpoints.aiAgentConfigUrl`
   *   3. the component's built-in default (`/api/ai-agents/<slug>`)
   * So agent mode works with ZERO wiring, yet every route stays overridable.
   */
  activeAgentSlug?: string

  /** Optional agent switcher callback (host renders the agent picker UI). */
  onAgentChange?: (slug: string) => void

  /**
   * Per-component override for the agent display-config route. Highest
   * precedence (over `runtime.endpoints.aiAgentConfigUrl` and the built-in
   * default). Lets a single embed point a specific agent at a custom/proxied
   * endpoint without changing the shared runtime. Optional.
   */
  aiAgentConfigUrl?: (slug: string) => string

  /**
   * Initial active mode for uncontrolled mode. Ignored when `activeMode`
   * is set. Defaults to `'guide'` when `modes.guide` is configured,
   * else `'mingo'`.
   */
  defaultActiveMode?: ChatMode

  /**
   * Wrapper shell around the chat body.
   *   - `'drawer'` (default): wraps in a body-level Radix Drawer (slide-in
   *     overlay from the right) — the original MPH / standalone behaviour.
   *   - `'none'`: no shell. Renders only the chat body so the consumer can
   *     host it inside their own container (e.g. `AppLayoutDrawerContent`).
   *     The internal "Ask AI" trigger and iOS body scroll-lock are also
   *     suppressed — those are Drawer-shell concerns. The consumer is
   *     responsible for mount/unmount and for opening/closing via the
   *     `open` / `onOpenChange` props (which the in-body close button still
   *     drives).
   */
  shell?: 'drawer' | 'none'

  /**
   * Display name of the signed-in user, shown as the sub-line under the chat
   * title in the panel header. The server-resolved chat identity
   * (`useChatIdentity().user.name`) always wins when present; this is the
   * host-supplied fallback so the header still shows who's signed in when the
   * identity endpoint doesn't return a name (e.g. a tenant whose identity
   * route omits it). Empty/undefined → the header renders the title alone.
   */
  userDisplayName?: string

  /**
   * Content overrides for the default (Mingo-mode) empty state
   * (`<MingoWelcome>`): greeting `title`/`subtitle`, the `promo` card, and
   * extra `quickActions` chips.
   * Each field falls back to the built-in OpenFrame defaults, so the kit
   * stays platform-agnostic. `onStartGuideChat` and `hasExistingChats` are
   * wired internally and are NOT overridable here. The quick-action
   * hover-preview callbacks are also wired internally.
   */
  mingoWelcome?: Omit<
    MingoWelcomeProps,
    | 'onStartGuideChat'
    | 'hasExistingChats'
    | 'onQuickActionHover'
    | 'onQuickActionHoverEnd'
  >

  /**
   * Content overrides for the Guide-mode empty state (`<GuideWelcome>`):
   * greeting `title`/`subtitle` and the `quickActions` chips. Each field falls
   * back to the built-in OpenFrame defaults. `onQuickAction` and the
   * slash-command list `children` are wired internally and not overridable.
   */
  guideWelcome?: Omit<GuideWelcomeProps, 'onQuickAction' | 'children'>

  /**
   * Entity-context picker config (Figma 31:28708 / 1:5699). When provided, the
   * composer renders the `+` "Assign Item" menu, the `@`-mention trigger, the
   * two-level picker (entity-type list → searchable multi-select), and the
   * selected-item chips; the selection rides out on send via
   * `sendMessage(text, { contextItems })`, which the host folds into its
   * outgoing payload. The host owns every entity source (REST/GraphQL) behind
   * `config.search`. Omit to disable the feature entirely.
   */
  contextPicker?: ChatContextPickerConfig
  /**
   * Host renderer for inline AI mentions `@marker:id` (e.g. the assistant
   * echoing `@device:<machineId>` in its reply). DIRECT MIRROR of
   * `renderEntityCard` for the `[card://]` grammar: the lib detects the token,
   * parses `{marker, id}`, and renders whatever the host returns — typically a
   * SELF-FETCHING chip (each entity type has its own fetcher) that resolves its
   * own display name by id. SEPARATE from `contextPicker`/`contextItems` (the
   * USER's attachments). Keep the function identity stable (module const /
   * `useCallback`) so the thread's streaming memo holds. Return null for a
   * marker the host can't render → the lib falls back to the bare token.
   */
  renderMention?: (reference: { marker: string; id: string }) => React.ReactNode
  /**
   * Host renderer that REPLACES the default label-only context chip on a sent
   * user bubble with a self-fetching entity chip — so a user's manually
   * attached context (`contextItems`) renders IDENTICALLY to an inline
   * `@marker:id` mention (same live name resolution + link). Mirror of
   * `renderMention`, for the attached-chip strip instead of inline tokens.
   * Return null for an item the host can't render → the lib falls back to the
   * label pill. Keep the identity stable (module const / `useCallback`).
   */
  renderContextItem?: (item: ChatContextItem) => React.ReactNode
  /**
   * One-shot prompt auto-sent into GUIDE mode. When set to a non-empty string
   * while `activeMode === 'guide'`, the panel sends it once via the active
   * (Guide/SSE) transport on the next render — e.g. an "Ask Mingo about X"
   * empty-state launcher that wants contextual guidance about a section — and
   * then invokes `onGuidePromptConsumed` so the host can null it. Nulling the
   * prop re-arms the one-shot, so the SAME text can be launched again later.
   * No-op in Mingo mode (the host should force `activeMode='guide'` alongside).
   */
  guidePendingPrompt?: string | null
  /**
   * Called once `guidePendingPrompt` has been handed to the Guide transport, so
   * the host can clear its queued prompt (which re-arms the one-shot).
   */
  onGuidePromptConsumed?: () => void
  /**
   * Host-rendered banner shown as a full-bleed row directly under the panel
   * header in MINGO mode only (Figma 192:51006) — e.g. a "current page context"
   * tag naming the entity whose detail page the user is viewing. The host owns
   * the data + click; pass `null`/return `null` to render nothing. Mirrors the
   * built-in `GuideModeBanner`, which fills the same slot in Guide mode.
   */
  mingoContextBanner?: React.ReactNode
}

// =============================================================================
// Chip href resolution
// =============================================================================

/** Tiny inline replacement for hub's `formatRelativePath`. */
const formatRelativePath = (p: string): string =>
  p.replace(/^\/+/, '').replace(/\/+$/, '')

/**
 * The committed `@`-mention text token, derived from a `type:id` identity key.
 * The TYPE is replaced with its backend mention MARKER (`markerByType`, e.g.
 * `KB_ARTICLE → 'kb'`), falling back to a lowercased type when the host didn't
 * declare one (`@device:…`, not `@DEVICE:…`); the `id` is left verbatim. The
 * structured context items keep the original (upper) entity-kind for the wire
 * enum, so this only affects the inline draft token. `[A-Za-z…]` in the input
 * regex matches either case, so commit/strip/detect stay symmetric.
 */
const mentionTokenOf = (key: string, markerByType: Map<string, string>): string => {
  const ci = key.indexOf(':')
  const type = ci === -1 ? key : key.slice(0, ci)
  const id = ci === -1 ? '' : key.slice(ci + 1)
  return `${markerByType.get(type) ?? type.toLowerCase()}:${id}`
}

/**
 * Fallback fan-out when the model didn't cite any source. Show the top-N
 * retrieved sources instead of zero chips. Mirrors Perplexity's behavior.
 */
const FALLBACK_TOP_RETRIEVED = 3

/**
 * Split (wide) Mingo layout metrics (Figma 113:60931 / 113:63630). The
 * "Current Chats" rail is a fixed 320px column; the chat block fills the rest
 * with a 400px floor. Below their sum the panel is too tight for two columns,
 * so the layout falls back to the stacked (single-column) view where the
 * history renders inline in the Mingo empty state. Purely width-driven and
 * self-contained — the host wires nothing.
 */
const HISTORY_RAIL_WIDTH = 320
const CHAT_BLOCK_MIN_WIDTH = 400
const SPLIT_MIN_WIDTH = HISTORY_RAIL_WIDTH + CHAT_BLOCK_MIN_WIDTH

/** Persists the user's rail collapse choice across drawer open/close + reloads. */
const RAIL_COLLAPSED_STORAGE_KEY = 'mingo-chat-history-collapsed'

/** Exit-timer budget (ms) before the collapsed rail unmounts — must cover the
 *  longest leave (`RAIL_COLLAPSE_MS`) plus a little slack so the width/opacity
 *  transition always settles before the element is removed. */
const RAIL_ANIM_MS = 320

/**
 * Presence + width-transition state for the history rail. The rail animates its
 * WIDTH (320 ⇄ 0) + opacity so the chat block grows/shrinks smoothly alongside
 * it — no hard reflow "jump" when it appears/disappears.
 *
 * - `mounted` — whether to render the rail at all (stays true through the leave
 *   so the collapse can play out before unmount).
 * - `active` — drives the expanded (`w-80 opacity-100`) vs collapsed
 *   (`w-0 opacity-0`) classes. On a fresh mount it flips true on the next frame
 *   so the open transitions from collapsed → expanded (an intro slide).
 */
function useRailPresence(open: boolean): { mounted: boolean; active: boolean } {
  const [mounted, setMounted] = useState(open)
  // Start collapsed even when open, so the first paint transitions OPEN.
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      // Flip to expanded only AFTER the browser has painted the collapsed
      // (w-0) frame — otherwise the mount + expand coalesce into one paint and
      // the width transition never plays (the rail "pops" open). A single rAF
      // fires before that first paint; a SECOND rAF lands after it, so the
      // enter transition runs from a real w-0 → w-80.
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setActive(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }
    setActive(false) // collapse (width/opacity transition to 0)
    if (!mounted) return // already gone — nothing to unmount later
    const t = setTimeout(() => setMounted(false), RAIL_ANIM_MS)
    return () => clearTimeout(t)
  }, [open, mounted])
  return { mounted, active }
}

/**
 * Animated container for a history-rail cell (the header's "Current Chats" cell
 * and the body's list column). The OUTER box transitions its width 0 ⇄ 320 +
 * opacity (so the neighbouring chat block slides smoothly); the INNER keeps a
 * fixed `w-80` so the rail content never squishes mid-animation — it's just
 * clipped by the shrinking outer (`overflow-hidden`). One easing both ways;
 * the collapse runs a touch longer than the open for a soft close.
 */
function RailSlot({
  active,
  innerClassName,
  children,
}: {
  active: boolean
  innerClassName?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        // Border on the OUTER so the rail/chat divider tracks the animating
        // boundary (and fades out with the panel) instead of vanishing early.
        'shrink-0 overflow-hidden border-r border-ods-border transition-[width,opacity] ease-out',
        active
          ? 'w-80 opacity-100 duration-[240ms]'
          : 'w-0 opacity-0 duration-[300ms]',
      )}
    >
      <div className={cn('h-full w-80', innerClassName)}>{children}</div>
    </div>
  )
}

/**
 * Built-in default route for an OpenFrame AI agent's display config — the
 * lowest-precedence fallback so "agent mode" works with ZERO endpoint wiring.
 * Overridden by `runtime.endpoints.aiAgentConfigUrl` or the `aiAgentConfigUrl`
 * prop. Same-origin relative path (works for host + same-origin embeds);
 * cross-origin embedders behind a proxy override with their absolute path.
 */
const DEFAULT_AI_AGENT_CONFIG_URL = (slug: string): string =>
  `/api/ai-agents/${encodeURIComponent(slug)}`

/**
 * Per-row width palette for the empty-state skeleton stack. Cycled
 * by index so each render is deterministic (no jitter between
 * loading frames) and the stack reads like a real, irregular list:
 *
 *   - titles vary from short ("Webinars") to long ("OpenFrame Pull Requests")
 *   - slashes vary from `/docs` to `/getting-started`
 *   - one row collapses to a single-line description to mimic the
 *     short-copy entries returned by `/api/docs/commands`.
 */
const SKELETON_ROW_VARIANTS: ReadonlyArray<{
  titleWidth: string
  slashWidth: string
  descriptionLines: 1 | 2
}> = [
  { titleWidth: 'w-32', slashWidth: 'w-20', descriptionLines: 2 },
  { titleWidth: 'w-28', slashWidth: 'w-16', descriptionLines: 2 },
  { titleWidth: 'w-40', slashWidth: 'w-24', descriptionLines: 2 },
  { titleWidth: 'w-44', slashWidth: 'w-28', descriptionLines: 2 },
  { titleWidth: 'w-36', slashWidth: 'w-24', descriptionLines: 1 },
  { titleWidth: 'w-24', slashWidth: 'w-16', descriptionLines: 2 },
]

// =============================================================================
// Slash-command dispatch
// =============================================================================

/**
 * Single source of truth for slash-command action dispatch. Maps an action
 * id to the corresponding chat-input-ref mutation. Same vocabulary as the
 * hub original.
 */
function dispatchSlashCommandAction(
  actionId: SlashCommandActionId,
  cmdId: string,
  ref: React.MutableRefObject<ChatInputRef | null>,
): void {
  const input = ref.current
  if (!input) return
  switch (actionId) {
    case 'browse':
      input.submit(formatSingularLookupInvocation(cmdId))
      return
    case 'search':
      input.setValue(`/${cmdId} `)
      return
    case 'find': {
      const text = `/${cmdId} ""`
      input.setValueAndCursor(text, text.length - 1)
      return
    }
    case 'display': {
      const text = `/${cmdId} display ""`
      input.setValueAndCursor(text, text.length - 1)
      return
    }
  }
}

/**
 * Resolve the icon for a source chip. `src.sourceRepo` is the
 * `RagTableConfig.id` — looked up via `SOURCE_ICON_NAMES`, then
 * resolved via `ICON_REGISTRY`. Falls back to `<FileText/>` so a
 * misconfigured chip doesn't crash render.
 */
function resolveChipIcon(src: ChatSource): React.ReactNode {
  const iconName = getSourceIconName(src.sourceRepo)
  const Icon = iconName ? resolveIcon(iconName, { variant: 'brand' }) : FileText
  return <Icon className="h-3.5 w-3.5" />
}

// =============================================================================
// SourceChip
// =============================================================================

/**
 * Source chip — TWO affordances per the hub original:
 *  1. Open: click → chip's URL (in-app for docs, new-tab for external).
 *  2. Ask: small `MessageSquare` icon-button on the right → fires
 *     `onDiscuss(ref)` to drill into THIS row via `entityIdFilter`.
 */
function SourceChip({
  src,
  baseRoute,
  chipBasePlatform,
  onClose,
  onDiscuss,
}: {
  src: ChatSource
  baseRoute: string
  chipBasePlatform?: string
  onClose: () => void
  onDiscuss?: (ref: ChatRef) => void
}) {
  const runtime = useRequiredChatRuntime()
  const router = useRouter()
  // Single CTA resolver — same icon, same href chain, same ChatRef
  // synthesis the inline card and search-result paths use.
  const cta = resolveSourceRowCTA(
    {
      sourceRepo: src.sourceRepo,
      documentType: src.documentType,
      id: src.id,
      title: src.name,
      externalUrl: src.externalUrl,
      targetPlatform: src.targetPlatform ?? null,
      path: src.path,
    },
    sourceRowCtxFromRuntime(runtime, { baseRoute, chipBasePlatform }),
  )
  const Icon = cta.icon
  const icon = <Icon className="h-3.5 w-3.5" />
  const chipClass = chatChipClass({ tone: 'secondary' })

  // Single source for the new-tab decision — same `computeIsNewTab` the
  // inline cards consume via `ChatCardLoader`.
  const decideTab = (href: string | null, targetPlatform: string | null) =>
    computeIsNewTab(runtime, href, targetPlatform)

  // Grouped source — hover/click reveals a dropdown with Open + Ask per row.
  if (src.items && src.items.length > 0) {
    const dropdownItems: HoverDropdownItem[] = src.items.map((item) => {
      const itemCta = resolveSourceRowCTA(
        {
          sourceRepo: src.sourceRepo,
          documentType: item.documentType,
          id: item.id,
          title: item.name,
          externalUrl: item.externalUrl,
          targetPlatform: item.targetPlatform ?? null,
          path: item.path,
        },
        sourceRowCtxFromRuntime(runtime, { baseRoute, chipBasePlatform }),
      )
      const ItemIcon = itemCta.icon
      return {
        label: item.name,
        icon: <ItemIcon className="h-3.5 w-3.5" />,
        href: itemCta.href ?? undefined,
        targetPlatform: itemCta.targetPlatform,
        path: item.path ?? null,
        secondaryAction:
          onDiscuss && itemCta.askable && itemCta.chatRef
            ? {
                icon: <MessageSquare />,
                label: `Ask about ${item.name}`,
                onClick: () => onDiscuss(itemCta.chatRef!),
              }
            : undefined,
      }
    })

    return (
      <HoverDropdown
        items={dropdownItems}
        renderAnchor={({ href, targetPlatform, path, className, children }) => (
          <NavLinkAnchorViaRuntime
            href={href}
            targetPlatform={targetPlatform ?? null}
            path={path}
            className={className}
          >
            {children}
          </NavLinkAnchorViaRuntime>
        )}
      >
        <span className={`${chipClass} cursor-pointer`}>
          {icon}
          <span className="truncate max-w-[160px]">
            [{src.index}] {src.name}
          </span>
        </span>
      </HoverDropdown>
    )
  }

  // Single-row chip helpers — wrap whatever clickable element each branch
  // produces with the trailing Ask `SourceActionButton`.
  const displayName = src.name || formatRelativePath(src.path)
  const chipBody = (label: string) => (
    <>
      {icon}
      <span className="truncate max-w-[160px]">
        [{src.index}] {label}
      </span>
    </>
  )
  const wrapChip = (clickable: React.ReactNode) => (
    <span className="inline-flex items-center">
      {clickable}
      <SourceActionButton
        chatRef={cta.chatRef}
        onDiscuss={onDiscuss}
        density="inline"
        className="ml-1 -mr-1"
      />
    </span>
  )

  // Click handler that routes through chat-runtime AND closes the chat
  // panel ONLY on same-tab navigation. New-tab clicks leave the chat
  // open so the user keeps their context while reading the new tab.
  // Modifier-clicks pass through to the browser's native behavior.
  // Single close model: matches `ChatCardNavWrap` for inline cards.
  const buildClickHandler = (href: string, path: string | null | undefined, targetPlatform: string | null, isNewTab: boolean) =>
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const handled = handleChatNavClick(e, runtime, { href, path, targetPlatform }, router.push)
      if (handled && !isNewTab && onClose) onClose()
    }

  // Entity chip with a resolved external URL. `resolveHrefForRuntime`
  // applies embed-mode origin prefix so modifier-click / hover-preview
  // / right-click "copy link" all land on the hub origin.
  if (cta.href && !!src.externalUrl) {
    const resolvedHref = resolveHrefForRuntime(cta.href, runtime)
    const isNewTab = decideTab(resolvedHref, cta.targetPlatform ?? null)
    return wrapChip(
      <a
        href={resolvedHref}
        {...newTabAnchorAttrs(isNewTab)}
        onClick={buildClickHandler(resolvedHref, null, cta.targetPlatform ?? null, isNewTab)}
        className={chipClass}
      >
        {chipBody(src.name)}
      </a>,
    )
  }

  // In-app navigable doc (markdown / data-room PDF).
  if (cta.href) {
    const resolvedHref = resolveHrefForRuntime(cta.href, runtime)
    const isNewTab = decideTab(resolvedHref, cta.targetPlatform ?? null)
    return wrapChip(
      <a
        href={resolvedHref}
        {...newTabAnchorAttrs(isNewTab)}
        onClick={buildClickHandler(resolvedHref, src.path, cta.targetPlatform ?? null, isNewTab)}
        className={chipClass}
        title={displayName}
      >
        {chipBody(displayName)}
      </a>,
    )
  }

  // No openable destination — static label + Ask affordance only.
  return wrapChip(
    <span className={`${chipClass} cursor-default`} title={displayName}>
      {chipBody(displayName)}
    </span>,
  )
}

/**
 * Cited-by-default source chip strip (Perplexity / ChatGPT pattern).
 * Cited rows render first; uncited tail hidden behind an expander.
 */
function SourceChips({
  cited,
  uncited,
  baseRoute,
  chipBasePlatform,
  onClose,
  onDiscuss,
}: {
  cited: ChatSource[]
  uncited: ChatSource[]
  baseRoute: string
  chipBasePlatform?: string
  onClose: () => void
  onDiscuss?: (ref: ChatRef) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (cited.length === 0) {
    const fallback = uncited.slice(0, FALLBACK_TOP_RETRIEVED)
    if (fallback.length === 0) return null
    return (
      <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-ods-border">
        <span className="text-h6 text-ods-text-muted uppercase">
          Top retrieved sources
        </span>
        <div className="flex flex-wrap gap-1.5">
          {fallback.map((src) => (
            <SourceChip
              key={src.index}
              src={src}
              baseRoute={baseRoute}
              chipBasePlatform={chipBasePlatform}
              onClose={onClose}
              onDiscuss={onDiscuss}
            />
          ))}
        </div>
      </div>
    )
  }

  const hiddenCount = uncited.length
  const hasOverflow = hiddenCount > 0

  return (
    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-ods-border">
      <span className="text-h6 text-ods-text-muted uppercase">
        Sources
      </span>
      <div
        className={`flex flex-wrap gap-1.5 ${expanded ? 'max-h-[200px] overflow-y-auto overscroll-contain' : ''}`}
      >
        {cited.map((src) => (
          <SourceChip
            key={src.index}
            src={src}
            baseRoute={baseRoute}
            chipBasePlatform={chipBasePlatform}
            onClose={onClose}
            onDiscuss={onDiscuss}
          />
        ))}
        {expanded &&
          uncited.map((src) => (
            <SourceChip
              key={src.index}
              src={src}
              baseRoute={baseRoute}
              chipBasePlatform={chipBasePlatform}
              onClose={onClose}
              onDiscuss={onDiscuss}
            />
          ))}
        {hasOverflow && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-h6 cursor-pointer transition-colors bg-ods-card border-ods-accent text-ods-accent hover:bg-ods-accent/10"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? 'Show fewer sources'
                : `Show ${hiddenCount} additional retrieved sources`
            }
          >
            {expanded
              ? 'Show less'
              : `+${hiddenCount} more retrieved ${
                  hiddenCount === 1 ? 'source' : 'sources'
                }`}
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

/**
 * EmbeddableChat — the floating "Ask AI" button + Mingo chat panel.
 * Lib-portable port of the hub's `<GlobalAskAI>`.
 */
export function EmbeddableChat(props: EmbeddableChatProps) {
  return <EmbeddableChatInner {...props} />
}

function EmbeddableChatInner({
  baseRoute,
  chipBasePlatform,
  enabledRagTableIds = null,
  emptyStateGreeting = null,
  suggestedQueries = null,
  open,
  onOpenChange,
  defaultOpen,
  showInternalTrigger = true,
  previewMode = false,
  extras,
  tableIdForDocumentType,
  modes,
  mingoState,
  mingoDialogCapabilities,
  activeMode: controlledActiveMode,
  onActiveModeChange,
  activeAgentSlug,
  onAgentChange: _onAgentChange,
  aiAgentConfigUrl: aiAgentConfigUrlProp,
  defaultActiveMode,
  shell = 'drawer',
  userDisplayName,
  mingoWelcome,
  guideWelcome,
  contextPicker,
  renderMention,
  renderContextItem,
  guidePendingPrompt,
  onGuidePromptConsumed,
  mingoContextBanner,
}: EmbeddableChatProps) {
  // `shell === 'none'` means the consumer hosts us inside their own panel
  // (e.g. AppLayoutDrawer in openframe-frontend). Several drawer-shell
  // concerns are unconditional in this codebase — gate them off here so
  // we don't double-up with the host's behaviour.
  const shellLess = shell === 'none'
  const runtime = useRequiredChatRuntime()
  // Optional on embedders (platform-agnostic); '' is a harmless sentinel for the
  // `ask-ai:open-with-ref` event filter below. (DocSource is a `string` alias.)
  const source = (runtime.source ?? '') as DocSource
  const commandsUrl = runtime.endpoints.commandsUrl
  // Server-resolved identity — drives the greeting first-name AND the
  // attachment capability flag. Single source of truth: the chat-identity
  // endpoint returns BOTH the auth tier and the resolved user, so the
  // displayed name always matches who the server thinks the user is.
  const { attachmentsEnabled, user: identityUser } = useChatIdentity()
  const viewUrlPrefix = runtime.endpoints.attachmentViewUrlPrefix

  // Dev-only warning when only one of `open` / `onOpenChange` is set.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const hasOpen = open !== undefined
      const hasHandler = onOpenChange !== undefined
      if (hasOpen !== hasHandler) {
        console.warn(
          '[EmbeddableChat] `open` and `onOpenChange` must both be provided ' +
            'for controlled mode, or both omitted for uncontrolled. ' +
            `Provided: open=${hasOpen}, onOpenChange=${hasHandler}.`,
        )
      }
    }
  }, [open, onOpenChange])

  const [isOpen = false, setIsOpen] = useControllableState<boolean>({
    prop: open,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  })

  // Suppress chat input auto-focus on touch devices (avoids popping the
  // on-screen keyboard during the bottom-sheet open animation).
  const [autoFocusInput] = useState(() => {
    if (typeof window === 'undefined') return false
    return !window.matchMedia('(pointer: coarse)').matches
  })

  // iOS scroll-lock — react-aria's two-layer approach plus body fixed-pos.
  // See hub original for the long mechanism comment; logic copied verbatim.
  // Skipped in shell-less mode: the host (AppLayoutDrawer) is in-layout, so
  // there's no body-level overlay that should block page scrolling.
  usePreventScroll({ isDisabled: !isOpen || shellLess })

  const navigatingAwayRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    if (shellLess) return
    if (typeof window === 'undefined') return
    if (!isIOS()) return

    navigatingAwayRef.current = false

    const scrollY = window.scrollY
    const openPathname = window.location.pathname
    const body = document.body
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      if (navigatingAwayRef.current) return
      if (window.location.pathname !== openPathname) return
      window.scrollTo(0, scrollY)
    }
  }, [isOpen, shellLess])

  // Imperative handle to the chat input.
  const chatInputRef = useRef<ChatInputRef | null>(null)
  // Full prompt of the currently hovered/focused quick-action chip, previewed
  // as ghost text in the empty composer (`ChatInput.previewText`) — declarative
  // + non-destructive: it never writes the editor value, so it can't clobber a
  // draft. `null` = not previewing.
  const [quickActionPreview, setQuickActionPreview] = useState<string | null>(null)

  // The slash-command registry (Guide onboarding cards) is loaded via
  // react-query below, after `activeMode` is resolved — gated on Guide mode and
  // cached across remounts. See `commandsById` / `commandsLoaded`.

  // Slash-command autocomplete config — passed to <ChatInput>.
  const slashCommandsProp = useMemo(
    () => ({
      fetchCommands: (prefix: string, signal?: AbortSignal) =>
        fetchSlashCommands(prefix, signal, commandsUrl),
      resolveSourceIcon: (sourceId: string) => {
        const iconName = getSourceIconName(sourceId)
        if (!iconName) return undefined
        return { Icon: resolveIcon(iconName, { variant: 'brand' }), label: sourceId }
      },
      onAction: (cmd: SlashCommandSummary, actionId: SlashCommandActionId) => {
        dispatchSlashCommandAction(actionId, cmd.id, chatInputRef)
      },
    }),
    [commandsUrl],
  )

  // Header sub-line: the full display name shown under the chat title. The
  // server-resolved identity wins; the host-supplied `userDisplayName` is the
  // fallback so the header still names the signed-in user when the identity
  // endpoint returns no name. Empty → the header shows the title alone.
  const headerUserName =
    identityUser?.name?.trim() ||
    [identityUser?.firstName, identityUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    userDisplayName?.trim() ||
    undefined

  // Synthesize `modes` from legacy props when the new API isn't used.
  // `modes` wins when both are present — the legacy top-level
  // `tableIdForDocumentType` is then silently ignored.
  const effectiveModes = useMemo<UseUnifiedChatModes>(() => {
    if (modes) return modes
    const guideOptions: UseSseChatAdapterOptions = tableIdForDocumentType
      ? { tableIdForDocumentType }
      : {}
    return { guide: guideOptions }
  }, [modes, tableIdForDocumentType])

  // Resolve dialog-management capabilities (rename / archive / archive-page /
  // restore) from a single source. With injected `mingoState` they come from
  // `mingoDialogCapabilities` (the host doesn't pass `modes.mingo`); otherwise
  // from the callback-config shape, where the presence of a callback IS the
  // capability. Both feed the same gating below so the JSX has one source.
  const mingoCaps = useMemo(() => {
    if (mingoState) {
      // Default OFF: the row ⋯ menu (Rename / Archive) and the archive page are
      // shown only when the host explicitly opts in — same capability-gating as
      // the archive button (`fetchArchivedDialogs` presence). Otherwise the menu
      // would advertise actions the host hasn't actually wired (no-ops).
      return {
        canRename: mingoDialogCapabilities?.canRename ?? false,
        canArchive: mingoDialogCapabilities?.canArchive ?? false,
        fetchArchivedDialogs: mingoDialogCapabilities?.fetchArchivedDialogs,
        unarchiveDialog: mingoDialogCapabilities?.unarchiveDialog,
        searchQuery: mingoDialogCapabilities?.searchQuery,
        onSearchChange: mingoDialogCapabilities?.onSearchChange,
      }
    }
    return {
      canRename: !!effectiveModes.mingo?.renameDialog,
      canArchive: !!effectiveModes.mingo?.archiveDialog,
      fetchArchivedDialogs: effectiveModes.mingo?.fetchArchivedDialogs,
      unarchiveDialog: effectiveModes.mingo?.unarchiveDialog,
      searchQuery: undefined as string | undefined,
      onSearchChange: undefined as ((query: string) => void) | undefined,
    }
  }, [mingoState, mingoDialogCapabilities, effectiveModes])

  // "Does Mingo mode exist?" — true via either the callback config OR injected
  // state. Gates the guide↔mingo back-chevron and the guide-mode banner.
  const hasMingoMode = !!effectiveModes.mingo || !!mingoState

  // Initial active mode picks the first configured slot when neither
  // controlled `activeMode` nor `defaultActiveMode` is provided. Guide
  // wins ties so legacy callers see no behaviour change.
  const initialActiveMode: ChatMode =
    controlledActiveMode ??
    defaultActiveMode ??
    (effectiveModes.guide ? 'guide' : 'mingo')

  const [uncontrolledActiveMode, setUncontrolledActiveMode] =
    useState<ChatMode>(initialActiveMode)
  const activeMode = controlledActiveMode ?? uncontrolledActiveMode
  const handleActiveModeChange = useCallback(
    (next: ChatMode) => {
      if (controlledActiveMode === undefined) {
        setUncontrolledActiveMode(next)
      }
      onActiveModeChange?.(next)
    },
    [controlledActiveMode, onActiveModeChange],
  )

  // Slash-command registry (Guide onboarding cards) via the shared
  // `useSlashCommandRegistry` react-query hook:
  //   - `enabled: activeMode === 'guide'` → never fetched in Mingo mode, so
  //     opening the default Mingo panel doesn't hit the commands endpoint.
  //   - Shares one cache entry (keyed on `commandsUrl`) with the SSE adapter's
  //     `displayRef` lookup, so Guide mode fetches `commands` ONCE, not twice.
  //   - Cached with `staleTime/gcTime: Infinity` inside the hook, so toggling
  //     to Guide or reopening the (remounting) drawer reads from cache.
  const { commands: commandsList, loaded: commandsLoaded } =
    useSlashCommandRegistry(commandsUrl, { enabled: activeMode === 'guide' })
  const commandsById = useMemo(() => {
    const map = new Map<string, SlashCommandSummary>()
    for (const cmd of commandsList) map.set(cmd.id, cmd)
    return map
  }, [commandsList])

  // Per-platform empty-state config (greeting + RAG-source filter + try-asking
  // chips), admin-edited in `/admin/chat-config`. Host-mode (in-app) callers
  // inject these as props and leave `emptyStateUrl` unset — the hook then
  // disables the fetch and returns the neutral fallback, so the props win
  // below. Cross-origin EMBEDDERS set `emptyStateUrl` and the fetched values
  // take precedence.
  //
  // Fetched EXACTLY like the slash-command registry: gated on
  // `activeMode === 'guide'` (every consumer — greeting, chip-catalog filter,
  // try-asking chips — is Guide-only), so opening the default Mingo panel never
  // hits the endpoint. Cached with `staleTime/gcTime: Infinity` inside the hook,
  // so toggling to Guide or reopening the (remounting) drawer reads from cache
  // — NOT a request per open.
  // Agent-mode URL override: when an OpenFrame agent is selected, point the
  // empty-state fetch at the agent's display-config endpoint (byte-compatible
  // EmptyStateConfig shape) instead of the platform `emptyStateUrl`. Works in
  // BOTH host and embed mode (no navigation-mode gate). Route precedence:
  //   prop `aiAgentConfigUrl` → runtime endpoint → built-in default
  // so agent mode functions with zero wiring yet stays fully overridable. The
  // single `emptyStateUrl` var below feeds BOTH the fetch AND the downstream
  // `emptyStateUrl ? fetched : prop` discriminator, so no other code changes.
  const resolveAgentConfigUrl =
    aiAgentConfigUrlProp ?? runtime.endpoints.aiAgentConfigUrl ?? DEFAULT_AI_AGENT_CONFIG_URL
  const agentConfigUrl = activeAgentSlug ? resolveAgentConfigUrl(activeAgentSlug) : undefined
  const emptyStateUrl = agentConfigUrl ?? runtime.endpoints.emptyStateUrl
  // Widen the fetch gate so a selected agent's display loads regardless of the
  // guide/mingo active mode (the platform empty-state stays Guide-only).
  // `MingoWelcome` still owns its own surface in mingo mode — this just warms
  // the agent config so greeting/suggested prompts are ready.
  const { config: emptyStateConfig, loading: emptyStateLoading } =
    useEmptyStateConfig(emptyStateUrl, {
      enabled: activeMode === 'guide' || !!activeAgentSlug,
    })
  // Resolution: fetched (when `emptyStateUrl` set) → explicit prop → default.
  // `greeting` is null-unambiguous so `??` chains cleanly; the arrays use
  // `emptyStateUrl` as the discriminator because `[]` is a legitimate fetched
  // value ("admin disabled every source") that must NOT fall back to the prop.
  const effectiveGreeting = emptyStateConfig.greeting ?? emptyStateGreeting
  const effectiveEnabledRagTableIds = emptyStateUrl
    ? emptyStateConfig.enabledRagTableIds
    : enabledRagTableIds
  const effectiveSuggestedQueries = emptyStateUrl
    ? emptyStateConfig.suggestedQueries
    : suggestedQueries
  // Structured quick actions (WITH icons) — the primary empty-state chip source
  // both endpoints emit. Only meaningful in embed mode (`emptyStateUrl` set); in
  // host mode chips arrive via the `guideWelcome.quickActions` prop instead.
  const effectiveQuickActions = emptyStateUrl ? emptyStateConfig.quickActions : []
  // Chat identity (name + icon) — surfaced on the empty state for BOTH agents
  // (`/api/ai-agents/:slug` → agent's `openframe_ai_agents` identity) AND
  // platform-driven chats (`/api/docs/empty-state` → `chat_admin_personas`
  // identity). Null (admin configured none, or a host that omits it) → the
  // built-in default (Mingo mark + "Mingo Guide"). Host-mode (no
  // `emptyStateUrl`) still gets identity via the `guideWelcome` prop below.
  const effectiveAssistantName = emptyStateConfig.name
  const effectiveAssistantIcon = emptyStateConfig.icon
  // The panel header needs a plain string. Host-mode passes the name via
  // `guideWelcome.title` (any ReactNode) rather than the fetch, so fall back to
  // it when it's a string. Null → header keeps the built-in "Mingo Guide".
  const headerAssistantName =
    effectiveAssistantName ??
    (typeof guideWelcome?.title === 'string' ? guideWelcome.title : null)

  const {
    messages: rawMessages,
    isLoading: chatLoading,
    sendMessage,
    discussRef,
    stopMessage,
    clearMessages,
    currentProvider,
    currentModelLabel,
    currentContextWindowMaxTokens,
    currentInputTokens,
    currentOutputTokens,
    currentCacheHitRatePct,
    currentUsageBreakdown,
    displayRef,
    // ─── Dialog management (Mingo-mode inline history) ───
    dialogs,
    activeDialogId,
    selectDialog,
    renameDialog,
    archiveDialog,
    isDialogsLoading,
    dialogsError,
    reloadDialogs,
    isMessagesLoading,
    hasMoreDialogs,
    loadMoreDialogs,
    hasMoreMessages,
    loadMoreMessages,
  } = useUnifiedChat({ modes: effectiveModes, activeMode, mingoStateOverride: mingoState })

  // ── One-shot Guide-mode launcher prompt ────────────────────────────────────
  // A host launcher (e.g. an "Ask Mingo about X" empty-state button) requests
  // contextual guidance by forcing `activeMode='guide'` and passing the prompt
  // via `guidePendingPrompt`. Send it once through the active (Guide/SSE)
  // `sendMessage`, then tell the host to clear it. The boolean ref re-arms when
  // the prop goes falsy (the host nulls it on consume), so the same text can be
  // launched again on a later click. Guarded on guide mode so a transient render
  // before the host's mode flip lands doesn't send into Mingo.
  const guidePromptSentRef = useRef(false)
  useEffect(() => {
    if (!guidePendingPrompt) {
      guidePromptSentRef.current = false
      return
    }
    if (activeMode !== 'guide' || guidePromptSentRef.current) return
    guidePromptSentRef.current = true
    void sendMessage(guidePendingPrompt)
    onGuidePromptConsumed?.()
  }, [guidePendingPrompt, activeMode, sendMessage, onGuidePromptConsumed])

  // Chat-attachment hooks (v2 attachment feature).
  const {
    attachments: stagedAttachments,
    readyAttachments,
    hasInflightUploads,
    addFiles: addAttachmentFiles,
    removeAttachment,
    clear: clearAttachments,
  } = useChatAttachments()
  const { panelRef: galleryPanelRef, modal: galleryModal } =
    useChatAttachmentImageGallery()

  // ─── Entity-context picker state (host-driven via `contextPicker`) ─────────
  // The lib owns selection + open/mention UI state; the host owns the data
  // (`contextPicker.search`) and the outgoing payload (it reads
  // `options.contextItems` on send). Inert unless `contextPicker` is set.
  const contextMaxItems = contextPicker?.maxItems ?? 10
  // The entity-context picker is Mingo-only: the Guide/SSE transport drops
  // `contextItems`, so exposing the +/@ picker there would silently lose the
  // user's attachment. Gate the composer's picker to Mingo mode (the staged
  // selection is also cleared on the mode toggle below).
  const contextPickerForMode = activeMode === 'mingo' ? contextPicker : undefined
  const [contextItems, setContextItems] = useState<ChatContextItem[]>([])
  const [contextPickerOpen, setContextPickerOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  // True while the `@`-mention trigger is active — drives the single-select
  // commit path below. A ref (not state) so the stable `toggleContextItem`
  // callback reads the live value without rebuilding per keystroke.
  const mentionActiveRef = useRef(false)
  useEffect(() => {
    mentionActiveRef.current = mentionQuery !== null
  }, [mentionQuery])
  // Keys (`"<type>:<id>"`) of context items that were committed via `@` and so
  // have a `@type:id` token in the draft text. MULTI-mention: several coexist.
  // Source of truth = the input text — deleting a token's chip drops its item.
  const mentionKeysRef = useRef<Set<string>>(new Set())

  // Staged picker selection is per-conversation and Mingo-only. Clear it (and the
  // mention bookkeeping) whenever the active dialog changes or the mode toggles,
  // so unsent chips can't bleed into another conversation — or into a Guide send,
  // where the SSE transport silently drops `contextItems`. Mirrors the post-send
  // reset in `handleSend`.
  useEffect(() => {
    setContextItems([])
    setMentionQuery(null)
    mentionKeysRef.current.clear()
  }, [activeDialogId, activeMode])

  // Map each entity type to its backend mention marker (host-declared on the
  // entity type). Drives the committed `@marker:id` token; missing markers fall
  // back to a lowercased type inside `mentionTokenOf`.
  const mentionMarkerByType = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of contextPicker?.entityTypes ?? []) if (t.marker) m.set(t.type, t.marker)
    return m
  }, [contextPicker?.entityTypes])

  // Stable type → icon resolver (entity-type glyph). Used both for the inline
  // composer chips (`commitMention` meta) and the message-bubble context chips.
  // Keyed on `entityTypes` only so an inline `contextPicker={{…}}` doesn't
  // rebuild it every render (its identity flows into the message memo).
  const contextEntityTypes = contextPicker?.entityTypes
  const resolveContextIcon = useMemo(() => {
    const byType = new Map<string, React.ReactNode>()
    for (const t of contextEntityTypes ?? []) byType.set(t.type, t.icon)
    return (item: ChatContextItem) => byType.get(item.type)
  }, [contextEntityTypes])

  const toggleContextItem = useCallback(
    (item: ChatContextItem) => {
      const key = `${item.type}:${item.id}`
      // `@`-mention flow → MULTI-select: commit a `@type:id` chip into the draft
      // (prior mentions left in place) so each picked entity stays visible inline
      // AND rides out in the context. The `+` flow (mention inactive) is the same
      // multi-select on the chip strip.
      if (mentionActiveRef.current) {
        // Already attached → no-op (the picker's `@` flow is add-then-close; the
        // chip already lives in the draft). Honour `maxItems` on growth.
        if (contextItems.some((p) => `${p.type}:${p.id}` === key)) return
        if (contextItems.length >= contextMaxItems) return
        chatInputRef.current?.commitMention(mentionTokenOf(key, mentionMarkerByType), {
          label: item.label,
          icon: resolveContextIcon(item),
        })
        setContextItems((prev) => [...prev, item])
        mentionKeysRef.current.add(key)
        return
      }
      setContextItems((prev) => {
        const idx = prev.findIndex((p) => `${p.type}:${p.id}` === key)
        if (idx !== -1) return prev.filter((_, i) => i !== idx)
        if (prev.length >= contextMaxItems) return prev
        return [...prev, item]
      })
    },
    [contextMaxItems, contextItems, mentionMarkerByType, resolveContextIcon],
  )

  const removeContextItem = useCallback((item: ChatContextItem) => {
    const key = `${item.type}:${item.id}`
    setContextItems((prev) => prev.filter((p) => `${p.type}:${p.id}` !== key))
    // Removing a mention-backed chip must also strip its `@type:id` token from
    // the draft, keeping text and context in lockstep (the inverse of deleting
    // the chip in the input, which drops the item via `handleContextValueChange`).
    if (mentionKeysRef.current.has(key)) {
      mentionKeysRef.current.delete(key)
      const cur = chatInputRef.current?.getValue() ?? ''
      const next = cur.replace(`@${mentionTokenOf(key, mentionMarkerByType)}`, '').replace(/\s{2,}/g, ' ').trimStart()
      chatInputRef.current?.setValue(next)
    }
  }, [mentionMarkerByType])

  // Draft → context reconciliation: when the user deletes a `@type:id` chip from
  // the input, drop the matching mention item. Checks EVERY token-backed key
  // (multi-mention). `+`-added items have no token in the text and are untouched.
  const handleContextValueChange = useCallback((value: string) => {
    for (const key of Array.from(mentionKeysRef.current)) {
      if (!value.includes(`@${mentionTokenOf(key, mentionMarkerByType)}`)) {
        mentionKeysRef.current.delete(key)
        setContextItems((prev) => prev.filter((p) => `${p.type}:${p.id}` !== key))
      }
    }
  }, [mentionMarkerByType])

  const openContextPicker = useCallback(() => {
    setMentionQuery(null)
    setContextPickerOpen(true)
  }, [])

  const closeContextPicker = useCallback(() => {
    // Strip the `@query` scaffolding so it never gets sent as literal text —
    // but ONLY when an `@`-mention trigger is actually active. When the picker
    // was opened via the `+` button (no trigger), there's no scaffolding to
    // clean up, and running the strip could eat an incidental trailing `@word`
    // the user typed. (Read the ref before clearing the query state.)
    if (mentionActiveRef.current) {
      chatInputRef.current?.removeMentionTrigger()
    }
    setContextPickerOpen(false)
    setMentionQuery(null)
  }, [])

  // `@`-trigger from the input: a non-null query opens (and filters) the
  // picker; null (token dismissed / space typed) closes it.
  const handleMentionQueryChange = useCallback((query: string | null) => {
    setMentionQuery(query)
    setContextPickerOpen(query !== null)
  }, [])

  // `renderMention` is HOST-provided (see the prop doc): the per-type renderer
  // for inline AI mentions `@marker:id` (mirror of `renderEntityCard`). The lib
  // forwards it verbatim to the message list and calls it from the `mention://`
  // override; the host returns a self-fetching chip.

  // Resolve base route. Hub default mapping: flamingo → /knowledge-base,
  // anything else → /data-room. Embedders override per platform. An embedder that
  // doesn't host an in-app doc viewer should NOT pass an empty baseRoute (that just
  // falls back to the platform default here) — instead it sets a truthy baseRoute +
  // `chipBasePlatform` so doc chips with no externalUrl resolve cross-platform to that
  // platform's public knowledge hub (`getBaseUrl(chipBasePlatform)/knowledge-base/…`),
  // exactly like the hub's openframe config (baseRoute:'/', chipBasePlatform:'openframe').
  const resolvedBaseRoute =
    baseRoute || (source === 'flamingo' ? '/knowledge-base' : '/data-room')

  const handleClose = useCallback(() => setIsOpen(false), [setIsOpen])

  const handleNavigationClose = useCallback(() => {
    navigatingAwayRef.current = true
    setIsOpen(false)
  }, [setIsOpen])

  // Stable panel-level handle for descendants (inline cards via
  // `ChatCardNavWrap` and markdown-body links via
  // `NavLinkAnchorViaRuntime`) to close the panel after same-tab
  // navigation. Uses `handleNavigationClose` (not `handleClose`) so the
  // iOS scroll-restore cleanup effect at the bottom of this file sees
  // `navigatingAwayRef.current = true` and skips restoring the chat's
  // saved scroll position over the freshly-loaded destination page.
  // Source chips already route through `handleNavigationClose`; inline
  // cards now match. New-tab clicks never invoke `closeChat`.
  const chatPanelHandle = useMemo<ChatPanelHandle>(
    () => ({ closeChat: handleNavigationClose }),
    [handleNavigationClose],
  )

  // Host-provided renderer for inline entity cards — routes through the
  // shared dispatcher in lib's `entity-cards/dispatch.tsx`.
  const renderEntityCard = useCallback(
    (reference: ChatRef): React.ReactNode =>
      renderChatInlineEntityCard(reference, {
        onDiscuss: discussRef,
        onDisplay: displayRef,
        baseRoute: resolvedBaseRoute,
        chipBasePlatform,
        extras,
      }),
    [discussRef, displayRef, resolvedBaseRoute, chipBasePlatform, extras],
  )

  // Stable assistant-icon element. `<ChatMessageList>` forwards this prop to
  // every assistant `<ChatMessageEnhanced>`, whose memo compares it BY
  // REFERENCE. Created inline in JSX it was a fresh element on every render,
  // defeating the memo for all assistant messages (re-rendering completed
  // bubbles — and re-mounting their inline cards — on every realtime chunk).
  // The Mingo avatar comes from the resolved agent CONFIG icon when one is
  // available (same server-driven path as every other identity glyph, via
  // `<EntityIcon>`) — falling back to the built-in `MingoIcon` when no config is
  // in play (host mode with no `activeAgentSlug`).
  const mingoAssistantIcon = useMemo(
    () =>
      effectiveAssistantIcon ? (
        <EntityIcon icon={effectiveAssistantIcon} size={24} />
      ) : (
        <MingoIcon className="h-6 w-6" cornerColor="var(--ods-flamingo-cyan-base)" />
      ),
    [effectiveAssistantIcon],
  )

  // Stable per-message timestamps. The memoized `<ChatMessageEnhanced>`
  // compares `timestamp.getTime()`, so we must NOT stamp `new Date()` fresh
  // on each render: a moving clock makes every message's timestamp differ
  // between renders, defeating memoization and forcing the WHOLE list (and
  // every open menu/card inside it) to re-render on every realtime chunk.
  // Prefer the host's real timestamp; otherwise stamp once per id and reuse
  // it (keeps the displayed time stable and lets memoization hold even when
  // the host omits a timestamp).
  const timestampCacheRef = useRef<Map<string, Date>>(new Map())

  // GUIDE MODE ONLY. Guide-mode user bubbles carry no host-supplied name/avatar
  // (the SSE adapter emits bare `{ role, content }`), so fall back to the
  // server-resolved identity (`useChatIdentity`): full name (first + last, or
  // the legacy `name`) for the bubble label / avatar initials, and `avatarUrl`
  // for the photo. In guide mode every user bubble IS the current viewer, so
  // this is correct.
  //
  // Mingo mode is EXCLUDED on purpose: its bubbles can belong to DIFFERENT
  // participants, whose name/avatar come from the host (`mingoState` messages) —
  // a different identity source. Overlaying the current viewer's identity there
  // stamped the viewer's photo onto EVERY user's bubble (the reported bug). When
  // not in guide mode these stay `undefined`, so Mingo bubbles use only their
  // host-supplied `m.name`/`m.avatar` (or the generic 'You' / no-avatar default).
  const guideUserName =
    activeMode === 'guide'
      ? [identityUser?.firstName, identityUser?.lastName].filter(Boolean).join(' ').trim() ||
        identityUser?.name?.trim() ||
        undefined
      : undefined
  const guideUserAvatar =
    activeMode === 'guide' ? identityUser?.avatarUrl?.trim() || undefined : undefined

  // Map docMessages → lib's Message type, forwarding chatRefs + scrollAnchor.
  const messages: Message[] = useMemo(() => {
    const cache = timestampCacheRef.current
    const seenIds = new Set<string>()

    const mapped = rawMessages.map((m) => {
      seenIds.add(m.id)
      let timestamp: Date
      if (m.timestamp != null) {
        timestamp = new Date(m.timestamp)
      } else {
        const cached = cache.get(m.id)
        timestamp = cached ?? new Date()
        if (!cached) cache.set(m.id, timestamp)
      }

      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        // Host-supplied per-message name/avatar win (e.g. the signed-in user's
        // full name + photo on a `user` bubble); fall back to the role default
        // when the host doesn't provide them.
        name: m.name ?? (m.role === 'assistant' ? 'Mingo' : (guideUserName ?? 'You')),
        avatar: m.avatar ?? (m.role === 'user' ? (guideUserAvatar ?? null) : null),
        // Forward the host's authorType so user bubbles get the same accent
        // name color as the standalone /mingo page (user → 'admin').
        ...(m.authorType ? { authorType: m.authorType } : {}),
        content: m.segments && m.segments.length > 0 ? m.segments : m.content,
        timestamp,
        assistantType: m.role === 'assistant' ? ('mingo' as const) : undefined,
        ...(m.chatRefs ? { chatRefs: m.chatRefs } : {}),
        ...(m.scrollAnchor ? { scrollAnchor: m.scrollAnchor } : {}),
        // Forward attached context items so the user bubble renders its chips.
        ...(m.contextItems && m.contextItems.length > 0
          ? { contextItems: m.contextItems }
          : {}),
      }
    })

    // Drop cached fallbacks for messages no longer present so the map can't
    // grow unbounded across a long-lived session.
    if (cache.size > seenIds.size) {
      for (const id of cache.keys()) {
        if (!seenIds.has(id)) cache.delete(id)
      }
    }

    return mapped
  }, [rawMessages, guideUserName, guideUserAvatar])

  const handleSend = useCallback(
    (text: string) => {
      // Append chat-attachment markdown lines to the user's bubble.
      let augmentedText = text
      if (readyAttachments.length > 0) {
        const markdown = readyAttachments
          .map((att) => formatChatAttachmentMarkdownForBubble(att, viewUrlPrefix))
          .join('')
        augmentedText = `${text}${markdown}`
      }
      sendMessage(augmentedText, {
        ...(readyAttachments.length > 0
          ? { attachments: readyAttachments }
          : {}),
        ...(contextItems.length > 0 ? { contextItems } : {}),
      })
      if (readyAttachments.length > 0) {
        clearAttachments()
      }
      // Clear the staged context once it's been handed to the host's send.
      if (contextItems.length > 0) {
        setContextItems([])
      }
    },
    [sendMessage, readyAttachments, viewUrlPrefix, clearAttachments, contextItems],
  )

  // Admin "try-asking chips" → GUIDE-mode quick-action chips only (Mingo mode
  // deliberately doesn't surface them). Clicking one SENDS the query immediately
  // via the GuideWelcome `onQuickAction` → `handleSend` at the render site (no
  // pre-fill) — restoring the original behavior + the admin "sends" copy.
  const guideSuggestedActions = useMemo(
    () => {
      // Prefer the structured quick actions (label + prompt + icon) so embed
      // chips render icons identically to the host SSR path. Only fall back to
      // the legacy string-only `suggestedQueries` when no structured chips came
      // back (older backend, or an admin who configured none).
      if (effectiveQuickActions.length > 0) {
        return effectiveQuickActions.map((qa) => ({
          id: qa.id,
          label: qa.label,
          prompt: qa.prompt,
          iconName: qa.iconName,
          iconUrl: qa.iconUrl,
          iconProps: qa.iconProps,
          // Chip icon accent: the ADMIN-CONFIGURED identity color on the
          // agent/persona (`icon_props.color`) wins; the built-in slug map
          // (fae→pink, mingo→cyan) is only the fallback for unconfigured
          // built-in agents.
          accent: accentFromIdentityIcon(effectiveAssistantIcon) ?? getAgentAccent(activeAgentSlug),
        }))
      }
      return (effectiveSuggestedQueries ?? []).map((q, i) => ({
        id: `suggested-${i}`,
        label: q,
        prompt: q,
      }))
    },
    [effectiveQuickActions, effectiveSuggestedQueries, effectiveAssistantIcon, activeAgentSlug],
  )

  // Dialog-history concerns (archive page, read-only archived conversation,
  // rename/archive/unarchive modals) live in one hook so this component stays
  // a thin orchestrator. Destructured with the names the JSX below uses.
  const {
    fetchArchivedDialogs,
    unarchiveDialog,
    archiveOpen,
    archivedDialogs,
    archivedCursor,
    archivedLoading,
    archivedPending,
    openArchive,
    closeArchive,
    loadArchivedPage,
    handleArchivedSelect,
    handleSelectDialog,
    isOpeningDialog,
    isViewingArchived,
    handleBack,
    resetToNewChat,
    activeDialog,
    renameTarget,
    setRenameTarget,
    archiveTarget,
    setArchiveTarget,
    restoreTarget,
    setRestoreTarget,
    handleConfirmRename,
    handleConfirmArchive,
    handleConfirmRestore,
  } = useChatDialogManager({
    dialogs,
    activeDialogId,
    selectDialog,
    clearMessages,
    renameDialog,
    archiveDialog,
    fetchArchivedDialogs: mingoCaps.fetchArchivedDialogs,
    unarchiveDialog: mingoCaps.unarchiveDialog,
  })

  const handleOpen = useCallback(() => setIsOpen(true), [setIsOpen])

  // Close on every pathname change. Lib has no `usePathname()`, so we pass
  // `null` — embedders that want pathname-driven close can wrap this
  // component with their own close-on-navigation effect. The hub mounts
  // `<HubRuntimeProvider>` which already supplies this behavior on the
  // outer shell, so the chat panel close is a single concern here.
  useCloseOnNavigation(handleNavigationClose, null)

  // Listen for cross-component "open chat with this row" events. Fired by
  // search bars when the user clicks a result with no public URL.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          source: string
          ref: { type: string; id: string; title: string; url: string | null }
        }>
      ).detail
      if (!detail || detail.source !== source) return
      setIsOpen(true)
      setTimeout(() => discussRef(detail.ref as ChatRef), 0)
    }
    window.addEventListener('ask-ai:open-with-ref', handler)
    return () => window.removeEventListener('ask-ai:open-with-ref', handler)
  }, [source, discussRef, setIsOpen])

  // Listen for plain "open chat" events (no row context). Fired by the
  // header MingoAiButton. Same strict source filter as `ask-ai:open-with-ref`
  // above: events without a matching source are ignored.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ source?: string }>).detail
      if (!detail || detail.source !== source) return
      setIsOpen(true)
    }
    window.addEventListener('ask-ai:open', handler)
    return () => window.removeEventListener('ask-ai:open', handler)
  }, [source, setIsOpen])

  const hasMessages = messages.length > 0
  // First dialog page in flight and nothing cached yet — we don't yet know if
  // the user is new or returning, so the Mingo empty state shows a skeleton
  // rather than flashing the new-user greeting+grid before the list lands.
  const dialogsInitialLoading = isDialogsLoading && dialogs.length === 0
  // Dialog list failed to load (e.g. backend down) and we have nothing cached.
  // Distinct from "no chats" so the Mingo empty state can offer a retry instead
  // of the new-user greeting (which misleadingly advertises Guide).
  const dialogsLoadError = dialogsError && dialogs.length === 0
  // A conversation is "open" the instant a chat is selected (`isOpeningDialog` /
  // `isViewingArchived` are set synchronously on click) — not only once its
  // history has loaded (`hasMessages`). Driving the surface + content branch
  // off this makes the normal-chat open animate identically to the archived
  // one instead of lagging behind the message fetch.
  // In `previewMode`, the host drives the whole state (`mingoStateOverride`) and
  // there is no dialog manager to set `isOpeningDialog`. So an embedded preview
  // that wants a message-list skeleton (real header + composer, skeleton bubbles)
  // signals it via `isMessagesLoading` — treat that as an open conversation so
  // the content branch shows the skeleton instead of the new-user welcome.
  const hasConversation =
    hasMessages || isOpeningDialog || isViewingArchived || (previewMode && isMessagesLoading)
  // Opening a dialog whose history hasn't arrived yet — show a message-list
  // skeleton instead of an empty thread so the open reads as "loading" rather
  // than a blank flash before the bubbles stream in.
  const messagesInitialLoading = isMessagesLoading && !hasMessages
  // Keys the content region so each distinct view (open conversation, Mingo
  // welcome, Guide onboarding) remounts on switch → fades in for 200ms, the
  // same feel as the surface flip. Switching dialogs stays "conversation" so
  // streaming messages don't re-trigger the fade.
  const contentViewKey = hasConversation ? 'conversation' : activeMode
  // Guide-mode empty state (no open conversation) — drives the "Mingo Guide"
  // header, the guide banner, and the GuideWelcome content branch.
  const isGuideEmpty = !hasConversation && activeMode === 'guide'
  // Quick-action chips exist in BOTH empty states (Guide onboarding + Mingo
  // welcome). If the chip row goes away (a message is sent, or the mode
  // switches) while a chip is still hovered, drop the in-flight preview so it
  // can't leak into the next composer state.
  const isQuickActionEmpty =
    !hasConversation && (activeMode === 'guide' || activeMode === 'mingo')
  useEffect(() => {
    if (!isQuickActionEmpty) setQuickActionPreview(null)
  }, [isQuickActionEmpty])
  // The guide-empty back-chevron returns to Mingo — only offer it when Mingo
  // mode actually exists to return to (guide is normally entered from Mingo).
  const guideCanReturnToMingo = isGuideEmpty && hasMingoMode
  const sourceLabel = source === 'flamingo' ? 'Knowledge Base' : 'Data Room'

  // Empty-state chip grid — derived directly from the fetched slash commands.
  const enabledSet = useMemo(
    () =>
      effectiveEnabledRagTableIds
        ? new Set<string>(effectiveEnabledRagTableIds)
        : null,
    [effectiveEnabledRagTableIds],
  )
  const chipCommands = useMemo(() => {
    const out: SlashCommandSummary[] = []
    for (const cmd of commandsById.values()) {
      if (cmd.displayOrder === undefined) continue
      if (enabledSet && cmd.primarySourceId && !enabledSet.has(cmd.primarySourceId))
        continue
      out.push(cmd)
    }
    out.sort((a, b) => {
      const ao = a.displayOrder ?? Number.POSITIVE_INFINITY
      const bo = b.displayOrder ?? Number.POSITIVE_INFINITY
      if (ao !== bo) return ao - bo
      return a.id.localeCompare(b.id)
    })
    return out
  }, [commandsById, enabledSet])

  // Find sources for the last assistant message; split into cited / uncited.
  const lastAssistantMsg = [...rawMessages].reverse().find((m) => m.role === 'assistant')
  const lastSources = useMemo(() => {
    if (chatLoading) return undefined
    const sources = lastAssistantMsg?.sources
    if (!sources || sources.length === 0) return undefined
    const content = lastAssistantMsg?.content || ''
    const citationOrder = [...content.matchAll(/\[(\d+)\]/g)].map((m) =>
      parseInt(m[1], 10),
    )
    const seenOrder = new Map<number, number>()
    citationOrder.forEach((idx) => {
      if (!seenOrder.has(idx)) seenOrder.set(idx, seenOrder.size)
    })
    const cited = sources
      .filter((s) => seenOrder.has(s.index))
      .sort((a, b) => (seenOrder.get(a.index) ?? 0) - (seenOrder.get(b.index) ?? 0))
    const uncited = sources.filter((s) => !seenOrder.has(s.index))
    return { cited, uncited }
  }, [lastAssistantMsg, chatLoading])


  // Host node for in-panel Radix portals (see the body wrapper below).
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null)

  // ── Split (wide) Mingo layout ─────────────────────────────────────────────
  // The panel measures its own width and, in Mingo mode, promotes the inline
  // dialog history to a fixed 320px "Current Chats" rail once there's room for
  // both it and a 400px chat block. Narrower than that (or collapsed, or Guide
  // mode / archive page) it stays the stacked single-column layout with the
  // history inline in the empty state. Fully self-contained — the host opts
  // into nothing; the switch is width-driven inside this component.
  const [panelWidth, setPanelWidth] = useState(0)
  const panelMeasureRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = panelMeasureRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (typeof w === 'number') setPanelWidth(w)
    })
    ro.observe(el)
    setPanelWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Rail collapse toggle (Figma ⟶| control), persisted so it survives the
  // drawer remounting on close.
  const [railCollapsed, setRailCollapsed] = useState(false)
  useEffect(() => {
    try {
      if (window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY) === '1')
        setRailCollapsed(true)
    } catch {
      // Storage can throw (private mode) — default to expanded.
    }
  }, [])
  const toggleRailCollapsed = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Best-effort persistence; the in-memory state still applies this session.
      }
      return next
    })
  }, [])

  // Header magnifier toggle — reveals the rail's built-in list search bar on
  // demand (matches the Figma header). Only meaningful when search is wired.
  const [railSearchOpen, setRailSearchOpen] = useState(false)

  // Layout decision. `wideMingo` gates the desktop two-cell header (which hosts
  // the expand control even while collapsed); `splitActive` additionally
  // requires the rail to be expanded before its column renders. The archive
  // page stays split-eligible: in wide mode it opens INSIDE the left rail (the
  // right chat block stays put), and only falls back to the full-panel archive
  // when stacked/collapsed.
  const splitEligible = activeMode === 'mingo'
  const canSplit = panelWidth >= SPLIT_MIN_WIDTH
  // Embedded previews (hero demo tabs) always use the compact single-column
  // header, never the two-column split — so `previewMode` opts out of `wideMingo`.
  const wideMingo = splitEligible && canSplit && !previewMode
  const splitActive = wideMingo && !railCollapsed
  // Keep the "Current Chats" rail (header cell + list column) mounted through
  // its width/opacity collapse so it eases away instead of hard-cutting; both
  // synchronized parts wrap in `<RailSlot active={railPresence.active}>`.
  const railPresence = useRailPresence(splitActive)
  // The wide header is used for BOTH wide layouts — split (rail beside the chat)
  // and collapsed (`wideCollapsed`: chat / new-chat welcome in the fill column,
  // rail hidden). Its built-in corner toggle expands/collapses the rail — the
  // only chat-list navigation in wide mode, so there's no back chevron here.
  // `|| railPresence.mounted` keeps it through the rail's exit animation when a
  // resize drops below the split threshold (wideMingo → narrow).
  const showWideHeader = wideMingo || railPresence.mounted

  // ── Narrow (stacked) list ⇄ compose navigation ────────────────────────────
  // The redesigned narrow layout (Figma 341:36190 / 113:69276) splits the old
  // combined empty state into two views: a "Current Chats" LIST (no composer)
  // and a "New Chat" COMPOSE view (greeting + composer) reached from the list's
  // "Start New Chat" button. Wide mode shows both columns at once, so this only
  // drives the single-column presentation.
  const [composeOpen, setComposeOpen] = useState(false)
  // Opening a conversation supersedes the compose view — reset it so backing out
  // of the conversation lands on the list, not a stale compose screen.
  useEffect(() => {
    if (hasConversation) setComposeOpen(false)
  }, [hasConversation])
  const isMingoMode = activeMode === 'mingo'
  // The stacked "Current Chats" list — the NARROW single-column Mingo view. It
  // is a narrow-only layout: in any wide layout the chat list lives in the rail,
  // and collapsing the rail (`wideCollapsed`) shows the chat / new-chat welcome
  // in the fill column (navigation is via re-expanding the rail), NOT the list.
  // Requires no open conversation, no archive, and not composing (the composer
  // lives on the compose view).
  const stackedListView =
    isMingoMode &&
    !hasConversation &&
    !archiveOpen &&
    !wideMingo &&
    !composeOpen

  // Shared header derivations — consumed by the stacked `ChatPanelHeader`, its
  // mobile fallback, and the desktop split header's right cell, so the title /
  // back / ⋯ semantics can't drift between layouts.
  const headerShowBack = hasConversation || guideCanReturnToMingo
  const headerTitle = hasConversation
    ? activeDialog?.title || 'New Chat'
    : isGuideEmpty
      ? (headerAssistantName ?? 'Mingo Guide')
      : 'Current Chats'
  const headerBackAriaLabel = hasConversation
    ? isViewingArchived
      ? 'Back to archive'
      : 'Back'
    : 'Back to Mingo'
  const headerOnBack = hasConversation
    ? handleBack
    : () => handleActiveModeChange('mingo')
  const headerOnRestore =
    isViewingArchived && unarchiveDialog && activeDialog
      ? () => setRestoreTarget(activeDialog)
      : undefined
  const headerOnRename =
    activeDialogId && activeDialog && mingoCaps.canRename
      ? () => setRenameTarget(activeDialog)
      : undefined
  const headerOnArchive =
    activeDialogId && activeDialog && mingoCaps.canArchive
      ? () => setArchiveTarget(activeDialog)
      : undefined
  const headerOnOpenArchive = fetchArchivedDialogs ? openArchive : undefined

  // "Start New Chat" (rail button) — reset to the new-chat welcome. Uses the
  // dedicated reset (not `handleBack`, which would reopen the archive when the
  // open conversation is archived) so it always lands on a fresh chat.
  const handleNewChat = useCallback(() => {
    resetToNewChat()
  }, [resetToNewChat])

  // Desktop split header ⋯ menu (active, non-archived conversation only).
  const splitHeaderMenuItems = [
    headerOnRename && { id: 'rename', label: 'Rename chat', onClick: headerOnRename },
    headerOnArchive && { id: 'archive', label: 'Archive chat', onClick: headerOnArchive },
  ].filter(Boolean) as ActionsMenuItem[]

  // Narrow (single-column) header. The Mingo empty state splits into a "Current
  // Chats" list header (search + archive, no back) and a "New Chat" compose
  // header (back to the list); conversations + guide keep the shared header
  // derivations. Wide mode uses its own two-cell header instead.
  const narrowMingoEmpty = isMingoMode && !hasConversation && !archiveOpen
  const narrowHeaderProps: ChatPanelHeaderProps = narrowMingoEmpty
    ? composeOpen
      ? {
          showBack: true,
          title: 'New Chat',
          subtitle: headerUserName,
          backAriaLabel: 'Back to chats',
          onBack: () => setComposeOpen(false),
          onClose: handleClose,
        }
      : {
          showBack: false,
          title: 'Current Chats',
          onClose: handleClose,
          onOpenArchive: headerOnOpenArchive,
          onToggleSearch: mingoCaps.onSearchChange
            ? () => setRailSearchOpen((o) => !o)
            : undefined,
          searchActive: railSearchOpen,
          searchQuery: mingoCaps.searchQuery,
          onSearchChange: mingoCaps.onSearchChange,
        }
    : {
        showBack: headerShowBack,
        title: headerTitle,
        subtitle: headerUserName,
        backAriaLabel: headerBackAriaLabel,
        isArchivedView: isViewingArchived,
        onBack: headerOnBack,
        onClose: handleClose,
        onRestore: headerOnRestore,
        onRename: headerOnRename,
        onArchive: headerOnArchive,
        onOpenArchive: headerOnOpenArchive,
      }

  // Chat body — defined once, then rendered inside whichever shell applies.
  // Radix overlays (⋯ menus, tooltips) portal into `portalHost` — a node inside
  // this panel — so they inherit the drawer's stacking context and need only a
  // small, local z-index instead of escalating to beat the drawer at the
  // document root. See `PortalContainerContext`.
  const body = (
        <PortalContainerContext.Provider value={portalHost}>
            {/* Panel surface depends on state (Figma):
                  • Narrow "Current Chats" LIST + FULL-PANEL archive page → grey
                    `ods-card` (#212121) — matching the grey rail those lists live
                    in when the panel is wide,
                  • Mingo welcome / compose (node 113:69208), Guide empty
                    (node 7532:328223), and the active conversation → dark
                    `ods-bg` (#161616).
                The header keeps its own grey `bg-ods-card`; the content and
                footer have no bg and inherit this root, so they flip together.
                The archive only tints the root when it's FULL-PANEL (`!splitActive`)
                — in the split layout it lives in the rail (which owns its own
                grey), so the chat block on the right must keep the conversation's
                dark surface instead of following the archive. */}
            <div
              ref={panelMeasureRef}
              className={`flex h-full flex-col overflow-hidden transition-colors duration-200 ${
                (archiveOpen && !splitActive) || stackedListView
                  ? 'bg-ods-card'
                  : 'bg-ods-bg'
              } ${previewMode ? 'pointer-events-none select-none' : ''}`}
            >
              {/* Archive-page ↔ chat-panel swap fades in (200ms) to match the
                  surface flip. The full-panel archive is used only when NOT in
                  the wide split layout — there the archive opens inside the left
                  rail instead (see the rail column below). */}
              {archiveOpen && !splitActive ? (
                <div
                  key="archive-view"
                  className="flex flex-1 min-h-0 flex-col animate-in fade-in-0 duration-200"
                >
                  <ChatArchivePage
                    dialogs={archivedDialogs}
                    onSelectDialog={handleArchivedSelect}
                    onBack={closeArchive}
                    onClose={handleClose}
                    isLoading={archivedLoading}
                    isFetching={archivedPending}
                    hasMore={archivedCursor != null}
                    onLoadMore={() => {
                      void loadArchivedPage(archivedCursor ?? undefined)
                    }}
                  />
                </div>
              ) : (
              <div
                key="chat-view"
                className="flex flex-1 min-h-0 flex-col animate-in fade-in-0 duration-200"
              >
              {showWideHeader ? (
                // Wide Mingo header (Figma 113:60931 / 113:63630). Split: a
                // two-cell bar — the "Current Chats" rail header (search /
                // archive / collapse) over the 320px rail + the chat-block header
                // (title / ⋯ / close) over the fill column. Collapsed
                // (`wideCollapsed`): the rail cell is gone, leaving the corner
                // expand toggle + the chat-block header (the fill column shows
                // the chat / new-chat welcome). No back chevron — chat-list
                // navigation is the rail toggle. Shown whenever the panel is wide
                // enough to split (`panelWidth ≥ SPLIT_MIN_WIDTH`), NOT gated on
                // the viewport `md` breakpoint — otherwise a 720–799px panel on a
                // sub-`md` viewport would split the body yet drop to the mobile
                // single-bar header (no rail search / collapse controls).
                <div className="flex h-14 w-full flex-shrink-0 overflow-hidden border-b border-ods-border bg-ods-card">
                    {railPresence.mounted && (
                      <RailSlot
                        active={railPresence.active}
                        innerClassName="flex overflow-hidden"
                      >
                        {archiveOpen ? (
                          // Archive open in the wide layout — the rail header
                          // turns into a "Chat Archive" back bar (the list itself
                          // renders in the rail below); the chat block is untouched.
                          // Back is a full-height leading cell, matching the other
                          // header cells (not a small inline chevron).
                          <>
                            <ChatHeaderIconButton
                              divider="right"
                              onClick={closeArchive}
                              aria-label="Back to chats"
                            >
                              <Chevron02LeftIcon size={24} />
                            </ChatHeaderIconButton>
                            <div className="flex min-w-0 flex-1 items-center px-[var(--spacing-system-mf)]">
                              <span className="min-w-0 flex-1 truncate text-h3 text-ods-text-primary">
                                Chat Archive
                              </span>
                            </div>
                          </>
                        ) : (
                          // "Current Chats" rail header — title fills, then the
                          // search + archive controls. When search is open the
                          // inline field takes over the title area in place
                          // (Figma 116:51217) and the magnifier toggle is hidden.
                          <>
                            {railSearchOpen && mingoCaps.onSearchChange ? (
                              <ChatHeaderSearchField
                                initialValue={mingoCaps.searchQuery}
                                onSearchChange={mingoCaps.onSearchChange}
                                onCollapse={() => setRailSearchOpen(false)}
                              />
                            ) : (
                              <>
                                <div className="flex min-w-0 flex-1 items-center px-[var(--spacing-system-mf)]">
                                  <span className="min-w-0 flex-1 truncate text-h3 text-ods-text-primary">
                                    Current Chats
                                  </span>
                                </div>
                                {mingoCaps.onSearchChange && (
                                  <ChatHeaderIconButton
                                    onClick={() => setRailSearchOpen((o) => !o)}
                                    aria-label="Search chats"
                                    aria-pressed={railSearchOpen}
                                  >
                                    <SearchIcon size={24} />
                                  </ChatHeaderIconButton>
                                )}
                              </>
                            )}
                            {headerOnOpenArchive && (
                              <ChatHeaderIconButton onClick={headerOnOpenArchive} aria-label="Chat archive">
                                <ClockHistoryIcon size={24} />
                              </ChatHeaderIconButton>
                            )}
                          </>
                        )}
                      </RailSlot>
                    )}

                    <div className="flex flex-1 min-w-0">
                      {/* Rail collapse / expand toggle — lives on the chat side,
                          at its left edge (Figma 259:90465). Right arrow collapses
                          the list; left arrow brings it back. */}
                      <button
                        type="button"
                        onClick={toggleRailCollapsed}
                        aria-label={splitActive ? 'Collapse chat list' : 'Show chat list'}
                        aria-pressed={!splitActive}
                        className="flex size-14 shrink-0 items-center justify-center border-r border-ods-border text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
                      >
                        {splitActive ? <Arrow02RightIcon size={24} /> : <Arrow02LeftIcon size={24} />}
                      </button>
                      {/* No back cell in the wide layout — the left rail (and
                          its collapse/expand toggle) already provides chat-list
                          navigation, so a back chevron would be redundant. */}
                      <div className="flex flex-1 min-w-0 items-center px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
                        <div className="flex min-w-0 flex-col">
                          <p className="truncate text-h3 leading-tight text-ods-text-primary">
                            {headerShowBack ? headerTitle : 'New Chat'}
                          </p>
                          {headerUserName && (
                            <p className="truncate text-h6 leading-tight text-ods-text-secondary">
                              {headerUserName}
                            </p>
                          )}
                        </div>
                      </div>

                      {isViewingArchived && headerOnRestore && (
                        <ChatHeaderIconButton onClick={headerOnRestore} aria-label="Unarchive chat">
                          <Refresh01LeftIcon size={24} />
                        </ChatHeaderIconButton>
                      )}
                      {headerShowBack && !isViewingArchived && splitHeaderMenuItems.length > 0 && (
                        <ActionsMenuDropdown
                          triggerAriaLabel="Chat actions"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                          groups={[{ items: splitHeaderMenuItems }]}
                          customTrigger={
                            <ChatHeaderIconButton aria-label="Chat actions">
                              <Ellipsis01Icon size={24} />
                            </ChatHeaderIconButton>
                          }
                        />
                      )}
                      <ChatHeaderIconButton onClick={handleClose} aria-label="Close">
                        <XmarkIcon size={24} />
                      </ChatHeaderIconButton>
                    </div>
                  </div>
              ) : (
                // Narrow single-column header — list / compose / conversation /
                // guide, resolved into `narrowHeaderProps` above. (Wide layouts,
                // including rail-collapsed, use the wide header above.) Embedded
                // previews (hero demo tabs) force the compact bar via `compact`.
                <ChatPanelHeader {...narrowHeaderProps} compact={previewMode} />
              )}

              {/* Guide-mode indicator banner (Figma node 7532:328222) —
                  full-bleed accent strip below the header. Shown only when
                  Guide mode is active AND the default (Mingo) mode also exists:
                  the banner contrasts the temporary Guide session against the
                  default chat, so it's meaningless in a guide-only setup. */}
              {activeMode === 'guide' && hasMingoMode && (
                <GuideModeBanner className="animate-in fade-in-0 duration-200" />
              )}

              {/* Mingo-mode current-page context banner (Figma 192:51006) —
                  full-bleed row under the header naming the entity whose detail
                  page the user is currently viewing, so they can ask Mingo to
                  recall it. Host-rendered (it reads the host's navigation-context
                  store) and host-gated to "has an open view"; this slot just
                  places it, mirroring `GuideModeBanner` above. */}
              {activeMode === 'mingo' && mingoContextBanner}

              {/* Chat-panel row. In the wide Mingo layout (`splitActive`) the
                  dialog history is hoisted into a fixed 320px "Current Chats"
                  rail on the left; the stacked layout keeps it inline in the
                  Mingo empty state (`<MingoChatHistory>` via `<MingoWelcome>`). */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {railPresence.mounted && (
                  <RailSlot
                    active={railPresence.active}
                    innerClassName="flex flex-col min-h-0 bg-ods-card"
                  >
                    {archiveOpen ? (
                      // Archive list inside the rail (header lives in the split
                      // header's left cell above). Right chat block stays put.
                      <ChatArchivePage
                        embedded
                        dialogs={archivedDialogs}
                        onSelectDialog={handleArchivedSelect}
                        isLoading={archivedLoading}
                        isFetching={archivedPending}
                        hasMore={archivedCursor != null}
                        onLoadMore={() => {
                          void loadArchivedPage(archivedCursor ?? undefined)
                        }}
                      />
                    ) : (
                      <MingoHistoryRail
                        dialogs={dialogs}
                        activeDialogId={activeDialogId ?? undefined}
                        onSelectDialog={handleSelectDialog}
                        onNewChat={handleNewChat}
                        onRequestRename={mingoCaps.canRename ? setRenameTarget : undefined}
                        onRequestArchive={mingoCaps.canArchive ? setArchiveTarget : undefined}
                        searchQuery={mingoCaps.searchQuery}
                        hasMore={hasMoreDialogs}
                        isLoadingMore={isDialogsLoading && dialogs.length > 0}
                        onLoadMore={() => {
                          void loadMoreDialogs()
                        }}
                        isLoadingHistory={dialogsInitialLoading}
                        loadError={dialogsLoadError}
                        onRetry={reloadDialogs}
                      />
                    )}
                  </RailSlot>
                )}
                <div className="flex flex-1 flex-col min-h-0 min-w-0">
                {stackedListView ? (
                  // Narrow "Current Chats" list (Figma 341:36190) — the default
                  // single-column view. No composer here; "Start New Chat" opens
                  // the compose view.
                  <MingoHistoryRail
                    className="animate-in fade-in-0 duration-200"
                    dialogs={dialogs}
                    activeDialogId={activeDialogId ?? undefined}
                    onSelectDialog={handleSelectDialog}
                    onNewChat={() => setComposeOpen(true)}
                    newChatAlways
                    onRequestRename={mingoCaps.canRename ? setRenameTarget : undefined}
                    onRequestArchive={mingoCaps.canArchive ? setArchiveTarget : undefined}
                    searchQuery={mingoCaps.searchQuery}
                    hasMore={hasMoreDialogs}
                    isLoadingMore={isDialogsLoading && dialogs.length > 0}
                    onLoadMore={() => {
                      void loadMoreDialogs()
                    }}
                    isLoadingHistory={dialogsInitialLoading}
                    loadError={dialogsLoadError}
                    onRetry={reloadDialogs}
                  />
                ) : (
                <>

              <div
                ref={galleryPanelRef}
                className="flex-1 flex flex-col min-h-0 p-[var(--spacing-system-m)]"
              >
                <div
                  key={contentViewKey}
                  className="flex-1 flex flex-col min-h-0 animate-in fade-in-0 duration-200"
                >
                {hasConversation ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    {messagesInitialLoading ? (
                      // Match the real list's `fullWidth` layout so swapping
                      // skeleton → bubbles doesn't shift the column. The panel
                      // wrapper above already pads (`p-[var(--spacing-system-m)]`),
                      // so the skeleton sits flush (no inner px/pb).
                      //
                      // In `previewMode` the chat lives in a fixed-height host box
                      // (e.g. the Mingo hero demo). The default bottom-anchored
                      // skeleton overflows a short panel and grows its OWN
                      // scrollbar — ugly. `fill` top-anchors + clips overflow so
                      // it reads as "the whole panel is loading" and never scrolls.
                      <ChatMessageListSkeleton
                        fullWidth
                        fill={previewMode}
                        className="flex-1"
                      />
                    ) : (
                    <ChatMessageList
                      messages={messages}
                      isTyping={chatLoading}
                      autoScroll={true}
                      // Passive in-page demos (previewMode) let the surrounding
                      // page scroll over the thread; the real drawer keeps
                      // containment (deck slide-scroll fix).
                      overscrollContain={!previewMode}
                      assistantType="mingo"
                      assistantIcon={mingoAssistantIcon}
                      renderEntityCard={renderEntityCard}
                      resolveContextIcon={resolveContextIcon}
                      renderContextItem={renderContextItem}
                      renderMention={renderMention}
                      NavLinkAnchor={NavLinkAnchorViaRuntime}
                      // Hide the message-list scrollbar for the Mingo panel
                      // (scroll stays functional). Scoped here via `className`
                      // instead of `ChatMessageList` itself, so other list
                      // consumers (host chat, tickets) keep their thin bar.
                      className="flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      // No inner `px`/`pb`: the panel wrapper already pads with
                      // `p-[var(--spacing-system-m)]`. The default content class
                      // adds `px-[var(--spacing-system-m)]` + `pb-…xs`, which
                      // double-inset the thread; `pb-0` overrides via twMerge.
                      contentClassName="max-w-none pb-0"
                      fullWidth
                      hasNextPage={hasMoreMessages}
                      isFetchingNextPage={isMessagesLoading}
                      onLoadMore={loadMoreMessages}
                    />
                    )}
                    {lastSources &&
                      (lastSources.cited.length > 0 ||
                        lastSources.uncited.length > 0) &&
                      !chatLoading && (
                        <div className="flex-shrink-0 pb-2">
                          <SourceChips
                            cited={lastSources.cited}
                            uncited={lastSources.uncited}
                            baseRoute={resolvedBaseRoute}
                            chipBasePlatform={chipBasePlatform}
                            onClose={handleNavigationClose}
                            onDiscuss={discussRef}
                          />
                        </div>
                      )}
                  </div>
                ) : activeMode === 'mingo' ? (
                  /* Figma node 7532:222444 — default (Mingo-mode) empty state:
                     centred greeting + capability grid + Guide-chat promo +
                     quick-action chips. Guide mode keeps the slash-command
                     onboarding list below. */
                  <MingoWelcome
                    onStartGuideChat={
                      effectiveModes.guide
                        ? () => handleActiveModeChange('guide')
                        : undefined
                    }
                    {...mingoWelcome}
                    // History now lives in its own list view (the wide rail or
                    // the narrow "Current Chats" list), so the welcome is always
                    // the new-user compose surface: greeting + grid + promo +
                    // primary Guide chip.
                    hasExistingChats={false}
                    // Hover/focus PREVIEWS the action's full prompt as ghost text
                    // in the empty composer (see `quickActionPreview` /
                    // `ChatInput.previewText`). Wired after the `{...mingoWelcome}`
                    // spread so the host can't override it.
                    onQuickActionHover={(action) =>
                      setQuickActionPreview(action.prompt ?? action.label)
                    }
                    onQuickActionHoverEnd={() => setQuickActionPreview(null)}
                  />
                ) : (
                  /* Figma node 7532:328214 — Guide-mode empty state: greeting
                     + slash-command onboarding list share one scroll region,
                     with a pinned quick-action chip row above the composer. */
                  <GuideWelcome
                    // Admin/host greeting customises the guide subtitle; an
                    // explicit `guideWelcome.subtitle` still wins (spread below).
                    subtitle={effectiveGreeting ?? undefined}
                    // While the admin greeting is still being fetched, render a
                    // subtitle skeleton instead of flashing empty → text.
                    subtitleLoading={emptyStateLoading}
                    {...guideWelcome}
                    // Agent identity (name → title, icon → empty-state glyph)
                    // wins over the host `guideWelcome` spread + built-in
                    // defaults; falls back to the host value when no agent is
                    // active. Placed after the spread so resolution is
                    // deterministic.
                    title={effectiveAssistantName ?? guideWelcome?.title}
                    icon={effectiveAssistantIcon ?? guideWelcome?.icon}
                    // Admin "try-asking chips" → Guide quick-action chips.
                    // Precedence: when an AGENT is active and its fetched chips
                    // arrived, the agent's chips win — the host array is the
                    // platform default, not the agent's. (`agentConfigUrl` is
                    // the same derived value that drives the config fetch, so
                    // this can never disagree with what was fetched; while the
                    // fetch is in-flight the fetched list is [] and host chips
                    // show.) Outside agent mode the host-provided
                    // `guideWelcome.quickActions` wins as before.
                    quickActions={
                      agentConfigUrl && guideSuggestedActions.length > 0
                        ? guideSuggestedActions
                        : (guideWelcome?.quickActions ?? guideSuggestedActions)
                    }
                    // Quick-action chips SEND the prompt immediately on click.
                    onQuickAction={(action) => {
                      setQuickActionPreview(null)
                      handleSend(action.prompt ?? action.label)
                    }}
                    // Hover/focus PREVIEWS the action's full prompt as ghost text
                    // in the empty composer (the chip label is short; this reveals
                    // what will be sent). Declarative + non-destructive — see
                    // `quickActionPreview` / `ChatInput.previewText`.
                    onQuickActionHover={(action) =>
                      setQuickActionPreview(action.prompt ?? action.label)
                    }
                    onQuickActionHoverEnd={() => setQuickActionPreview(null)}
                  >
                    {/* Figma node 7363:205938 — single-column slash-command
                        list. No own scroll (GuideWelcome's region scrolls); the
                        rounded-md frame holds the cards on the dark surface. */}
                    {(chipCommands.length > 0 || !commandsLoaded) && (
                      <div className="shrink-0 overflow-hidden rounded-md border border-ods-border">
                        {!commandsLoaded &&
                          chipCommands.length === 0 &&
                          SKELETON_ROW_VARIANTS.map((variant, i) => (
                            <MingoOnboardingCardSkeleton
                              key={`chip-skeleton-${i}`}
                              titleWidth={variant.titleWidth}
                              slashWidth={variant.slashWidth}
                              descriptionLines={variant.descriptionLines}
                            />
                          ))}
                        {chipCommands.map((cmd) => {
                          const Icon = resolveIcon(cmd.iconName)
                          const cmdId = cmd.id
                          const label = cmd.label ?? `/${cmdId}`
                          const cardActions = cmd.actions.map((action) => ({
                            id: action.id,
                            label: action.label,
                            onClick: () =>
                              dispatchSlashCommandAction(
                                action.id,
                                cmdId,
                                chatInputRef,
                              ),
                          }))
                          return (
                            <MingoOnboardingCard
                              key={cmdId}
                              icon={<Icon size={16} />}
                              title={label}
                              slashCommand={`/${cmdId}`}
                              description={cmd.description}
                              actions={cardActions}
                            />
                          )
                        })}
                      </div>
                    )}
                  </GuideWelcome>
                )}
                </div>
              </div>

              <ChatAttachmentChipStrip
                attachments={stagedAttachments}
                onRemove={removeAttachment}
                disabled={chatLoading}
              />

              <ChatComposer
                archived={isViewingArchived}
                inputRef={chatInputRef}
                onSend={handleSend}
                onStop={stopMessage}
                sending={chatLoading || hasInflightUploads}
                placeholder={
                  hasInflightUploads
                    ? 'Waiting for uploads to finish…'
                    : 'Ask a question...'
                }
                autoFocus={previewMode ? false : autoFocusInput}
                slashCommands={slashCommandsProp}
                previewText={quickActionPreview ?? undefined}
                showAttachmentButton={attachmentsEnabled && activeMode === 'guide'}
                attachmentsCount={stagedAttachments.length}
                onAddFiles={addAttachmentFiles}
                attachmentsDisabled={chatLoading}
                contextPicker={contextPickerForMode}
                selectedContextItems={contextItems}
                onToggleContextItem={toggleContextItem}
                onRemoveContextItem={removeContextItem}
                contextPickerOpen={contextPickerOpen}
                onOpenContextPicker={openContextPicker}
                onCloseContextPicker={closeContextPicker}
                mentionQuery={mentionQuery}
                onMentionQueryChange={handleMentionQueryChange}
                onValueChange={handleContextValueChange}
                model={{
                  provider: currentProvider ?? 'anthropic',
                  modelName: currentModelLabel ?? 'Claude',
                  usedTokens:
                    currentInputTokens != null
                      ? (currentInputTokens ?? 0) + (currentOutputTokens ?? 0)
                      : undefined,
                  contextWindow: currentContextWindowMaxTokens ?? undefined,
                  inputTokens: currentInputTokens ?? undefined,
                  outputTokens: currentOutputTokens ?? undefined,
                  hitRatePct: currentCacheHitRatePct ?? undefined,
                  breakdown: currentUsageBreakdown ?? undefined,
                }}
              />
                </>
                )}
                </div>
              </div>
              </div>
              )}
            </div>
            {galleryModal}

            {/* Rename / Archive / Unarchive chat modals (Figma 7592:225962,
                7592:226181). Triggered from the header ⋯ and the dialog-history
                rows; rendered inside the panel so they overlay the chat. */}
            <ChatDialogModals
              renameTarget={renameTarget}
              setRenameTarget={setRenameTarget}
              onConfirmRename={handleConfirmRename}
              archiveTarget={archiveTarget}
              setArchiveTarget={setArchiveTarget}
              onConfirmArchive={handleConfirmArchive}
              restoreTarget={restoreTarget}
              setRestoreTarget={setRestoreTarget}
              onConfirmRestore={handleConfirmRestore}
            />

            {/* Portal target for in-panel Radix overlays — `display: contents`
                so it adds no box; content is positioned `fixed` by Radix. */}
            <div ref={setPortalHost} style={{ display: 'contents' }} />
          </PortalContainerContext.Provider>
  )

  // Conditional shell: inline (shell-less host, e.g. AppLayoutDrawer, which
  // provides its own chrome/focus-trap/size) vs the body-level Radix Drawer
  // (backdrop, iOS scroll-lock, drag-to-resize). Both render the same `body`.
  const panel = shellLess ? (
    <ChatPanelContext.Provider value={chatPanelHandle}>
      {/* Shell-less hosts (AppLayoutDrawer) own the Radix Dialog but not its
          accessible name — Radix warns when a Dialog.Content has no Title. The
          panel supplies its own visually-hidden title here, mirroring the
          drawer-shell branch below, so it's accessible regardless of host. */}
      <VisuallyHidden>
        <DialogPrimitive.Title>{sourceLabel} AI Assistant</DialogPrimitive.Title>
      </VisuallyHidden>
      {body}
    </ChatPanelContext.Provider>
  ) : (
    <Drawer open={isOpen} onOpenChange={(o: boolean) => !o && handleClose()}>
      <ChatPanelContext.Provider value={chatPanelHandle}>
        {/* Panel-level handle for descendants (inline cards, markdown-body
            links) to close the panel after same-tab navigation. */}
        <DrawerContent
          side="right"
          flush
          resizable
          minSize={480}
          maxSize={1600}
          defaultSize={drawerDefaultWidth()}
          storageKey={DRAWER_WIDTH_KEY}
          resizeAriaLabel="Resize chat panel"
          overlayClassName="mingo-chat-overlay"
          aria-describedby={undefined}
          className="
            mingo-chat-content !bg-ods-bg shadow-2xl
            focus:outline-none focus-visible:outline-none
            w-screen md:w-auto
          "
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>{sourceLabel} AI Assistant</DialogPrimitive.Title>
          </VisuallyHidden>
          {body}
        </DrawerContent>
      </ChatPanelContext.Provider>
    </Drawer>
  )

  return (
    <>
      {/* Floating "Ask AI" button — sticky-dock pattern. Suppressed in
          shell-less mode: the host controls open/close. */}
      {showInternalTrigger && !shellLess && (
        <div
          aria-hidden={isOpen}
          className={`sticky bottom-0 h-0 z-[9990] pointer-events-none ${
            isOpen ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute bottom-4 md:bottom-6 right-4 md:right-6">
            <Button
              onClick={handleOpen}
              leftIcon={<MingoIcon className="h-5 w-5" color="currentColor" />}
              tabIndex={isOpen ? -1 : 0}
              className={`shadow-lg !w-auto pointer-events-auto ${
                isOpen ? '!pointer-events-none' : ''
              }`}
            >
              Ask AI
            </Button>
          </div>
        </div>
      )}
      {panel}
    </>
  )
}

