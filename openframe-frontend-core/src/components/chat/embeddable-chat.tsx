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
import { Chevron01LeftIcon } from '../icons-v2-generated/arrows/chevron-01-left-icon'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'

import { ChatFooter } from './chat-container'
import { ChatInput } from './chat-input'
import { ChatSidebar } from './chat-sidebar'
import { MingoOnboardingCard } from './mingo-onboarding-card'
import { MingoOnboardingCardSkeleton } from './mingo-onboarding-card-skeleton'
import { ChatMessageList } from './chat-message-list'
import { ModelDisplay } from './model-display'
import { SourceActionButton } from './source-action-button'
import { NavLinkAnchorViaRuntime } from './nav-link-anchor-via-runtime'
import { ChatAttachmentAddButton, ChatAttachmentChipStrip } from './chat-attachment-bar'
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
import type { UseNatsChatAdapterConfig } from './hooks/use-nats-chat-adapter'
import { useChatAttachments } from './hooks/use-chat-attachments'
import { useChatAttachmentImageGallery } from './hooks/use-chat-attachment-image-gallery'
import { useChatIdentity } from './hooks/use-chat-identity'
import { useCloseOnNavigation } from './hooks/use-close-on-navigation'
import { fetchSlashCommands, type SlashCommandSummary } from './hooks/use-slash-commands'

import type { ChatRef } from './chat-ref.types'
import type { ChatInputRef, SlashCommandActionId } from './types/component.types'
import type { Message } from './types/message.types'

import { formatChatAttachmentMarkdownForBubble } from './utils/chat-attachment-markdown'
import { handleChatNavClick } from './utils/nav-click-handler'
import { computeIsNewTab, newTabAnchorAttrs } from './utils/nav-anchor-props'
import { resolveHrefForRuntime } from './utils/chat-nav-resolution'
import { ChatPanelContext, type ChatPanelHandle } from './chat-panel-context'
import { resolveSourceRowCTA, sourceRowCtxFromRuntime } from './utils/source-row-cta'
import { chatChipClass } from './utils/chip-styles'
import { getIconComponent } from './utils/icon-registry'
import { resolveOnboardingIcon } from './utils/onboarding-icons'
import { getSourceIconName } from './utils/source-icons'
import { formatSingularLookupInvocation } from './utils/slash-dispatch-utils'


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
   * Controlled active-mode. When provided, `onActiveModeChange` MUST
   * also be provided. For uncontrolled use see `defaultActiveMode`.
   */
  activeMode?: ChatMode

  /** Controlled active-mode change handler. Required when `activeMode` is set. */
  onActiveModeChange?: (mode: ChatMode) => void

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
}

// =============================================================================
// Chip href resolution
// =============================================================================

/** Tiny inline replacement for hub's `formatRelativePath`. */
const formatRelativePath = (p: string): string =>
  p.replace(/^\/+/, '').replace(/\/+$/, '')

/**
 * Fallback fan-out when the model didn't cite any source. Show the top-N
 * retrieved sources instead of zero chips. Mirrors Perplexity's behavior.
 */
const FALLBACK_TOP_RETRIEVED = 3

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
  const Icon = iconName ? getIconComponent(iconName) : FileText
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
        <span className="text-[11px] text-ods-text-muted uppercase tracking-wider font-medium">
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
      <span className="text-[11px] text-ods-text-muted uppercase tracking-wider font-medium">
        Sources
      </span>
      <div
        className={`flex flex-wrap gap-1.5 ${expanded ? 'max-h-[200px] overflow-y-auto' : ''}`}
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
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer transition-colors bg-ods-card border-ods-accent text-ods-accent hover:bg-ods-accent/10"
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
  open,
  onOpenChange,
  defaultOpen,
  showInternalTrigger = true,
  extras,
  tableIdForDocumentType,
  modes,
  activeMode: controlledActiveMode,
  onActiveModeChange,
  defaultActiveMode,
  shell = 'drawer',
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

  // Async lookup of the slash-command registry for the current source.
  const [commandsById, setCommandsById] = useState<Map<string, SlashCommandSummary>>(
    () => new Map(),
  )
  const [commandsLoaded, setCommandsLoaded] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const ctrl = new AbortController()
    setCommandsLoaded(false)
    fetchSlashCommands('', ctrl.signal, commandsUrl)
      .then((commands) => {
        if (cancelled) return
        const map = new Map<string, SlashCommandSummary>()
        for (const cmd of commands) map.set(cmd.id, cmd)
        setCommandsById(map)
        setCommandsLoaded(true)
      })
      .catch((err) => {
        if (!cancelled && (err as Error)?.name !== 'AbortError') {
          console.warn('[embeddable-chat] failed to fetch slash commands:', err)
          setCommandsLoaded(true)
        }
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [isOpen, source, commandsUrl])

  // Slash-command autocomplete config — passed to <ChatInput>.
  const slashCommandsProp = useMemo(
    () => ({
      fetchCommands: (prefix: string, signal?: AbortSignal) =>
        fetchSlashCommands(prefix, signal, commandsUrl),
      resolveSourceIcon: (sourceId: string) => {
        const iconName = getSourceIconName(sourceId)
        if (!iconName) return undefined
        return { Icon: getIconComponent(iconName), label: sourceId }
      },
      onAction: (cmd: SlashCommandSummary, actionId: SlashCommandActionId) => {
        dispatchSlashCommandAction(actionId, cmd.id, chatInputRef)
      },
    }),
    [commandsUrl],
  )

  // Greeting first-name comes from the SERVER-resolved identity (single
  // source of truth — never a client-injected runtime field). Resolution
  // order:
  //   1. `identityUser.firstName` — dedicated optional field from the
  //      identity webservice (populated via `X-Chat-First-Name` for
  //      bearer-act-as, or by the hub's profile lookup for cookie sessions).
  //   2. `identityUser.name.split(' ')[0]` — legacy fallback for sources
  //      that only return a full name. Empty-string-safe (`?.`-chain).
  //   3. `undefined` — anon, loading, or no name available → greeting
  //      collapses to the no-name variant `Hey, I'm Mingo`.
  // We coalesce an empty string to `undefined` so the JSX `userName ? …`
  // branch treats `''` the same as missing — embedders that send
  // `firstName: ''` shouldn't render `Hey , I'm Mingo`.
  const userName =
    (identityUser?.firstName?.trim() ||
      identityUser?.name?.split(' ')[0]?.trim()) ||
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

  // Mode toggle visible only when both slots are populated.
  const showModeToggle =
    effectiveModes.guide !== undefined && effectiveModes.mingo !== undefined

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
    // ─── Dialog management (Mingo-mode sidebar) ───
    dialogs,
    activeDialogId,
    selectDialog,
    startNewDialog,
    isDialogsLoading,
    hasMoreDialogs,
    loadMoreDialogs,
  } = useUnifiedChat({ modes: effectiveModes, activeMode })

  // Whether the in-panel dialog sidebar should render. Gated on:
  //   1. Mingo mode is active (Guide has localStorage-only history that
  //      isn't yet structured as a sidebar list — see
  //      [[chat-architecture-and-migration]] for the asymmetry).
  //   2. The host wired `fetchDialogs` — managed-dialog mode, not the
  //      bare-transport Tauri flow.
  const showSidebar =
    activeMode === 'mingo' && effectiveModes.mingo?.fetchDialogs !== undefined

  // Pending startNewDialog promise — used to gate the "Start new chat"
  // button while creation is in flight so a double-click doesn't spawn
  // two backend dialogs.
  const [isStartingNewDialog, setIsStartingNewDialog] = useState<boolean>(false)
  const handleStartNewDialog = useCallback(async () => {
    if (isStartingNewDialog) return
    setIsStartingNewDialog(true)
    try {
      await startNewDialog()
    } finally {
      setIsStartingNewDialog(false)
    }
  }, [isStartingNewDialog, startNewDialog])

  const handleSelectDialog = useCallback(
    (id: string) => {
      selectDialog(id)
    },
    [selectDialog],
  )

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

  // Resolve base route. Hub default mapping: flamingo → /knowledge-base,
  // anything else → /data-room. Embedders override per platform. An embedder that
  // doesn't host an in-app doc viewer should NOT pass an empty baseRoute (that just
  // falls back to the platform default here) — instead it sets a truthy baseRoute +
  // `chipBasePlatform` so doc chips with no externalUrl resolve cross-platform to that
  // platform's public knowledge hub (`getBaseUrl(chipBasePlatform)/knowledge-base/…`),
  // exactly like the hub's openframe config (baseRoute:'/', chipBasePlatform:'flamingo').
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

  // Map docMessages → lib's Message type, forwarding chatRefs + scrollAnchor.
  const messages: Message[] = useMemo(
    () =>
      rawMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        name: m.role === 'assistant' ? 'Mingo AI' : 'You',
        content: m.segments && m.segments.length > 0 ? m.segments : m.content,
        timestamp: new Date(),
        assistantType: m.role === 'assistant' ? ('mingo' as const) : undefined,
        ...(m.chatRefs ? { chatRefs: m.chatRefs } : {}),
        ...(m.scrollAnchor ? { scrollAnchor: m.scrollAnchor } : {}),
      })),
    [rawMessages],
  )

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
      })
      if (readyAttachments.length > 0) {
        clearAttachments()
      }
    },
    [sendMessage, readyAttachments, viewUrlPrefix, clearAttachments],
  )

  const handleNewChat = useCallback(() => {
    clearMessages()
  }, [clearMessages])

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

  const hasMessages = messages.length > 0
  const sourceLabel = source === 'flamingo' ? 'Knowledge Base' : 'Data Room'
  const greetingText =
    emptyStateGreeting || `Ask me anything about ${sourceLabel.toLowerCase()}.`

  // Empty-state chip grid — derived directly from the fetched slash commands.
  const enabledSet = useMemo(
    () => (enabledRagTableIds ? new Set<string>(enabledRagTableIds) : null),
    [enabledRagTableIds],
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


  return (
    <>
      {/* Floating "Ask AI" button — sticky-dock pattern. See hub original
          for the full mechanism explanation. Suppressed in shell-less mode:
          the host controls open/close, so an internal trigger would race. */}
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

      {/*
        Conditional shell — overlay (Drawer, MPH default) vs inline
        (positioned `<aside>` anchored to the nearest positioned
        ancestor, openframe-frontend's nav-embedded chat). Both share
        the same `body` JSX so the chat content is defined exactly
        once; the IIFE keeps both branches type-balanced inside JSX
        (no opening tag in one ternary branch + closing in another).
      */}
      {(() => {
        const body = (
          <>
            <div className="flex h-full flex-col overflow-hidden">
              {/* Figma node 7363:205930 — top-navigation. Title intentionally
                  omitted; a chevron-left + "New Chat" back-style affordance
                  appears on the left when a conversation is active
                  (hasMessages) and resets the chat. Close on the right.
                  Left-borders act as 1px cell dividers. */}
              <div className="flex-shrink-0 flex h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card">
                <div className="flex flex-1 min-w-0 items-center gap-2 px-4 py-3">
                  {hasMessages ? (
                    <>
                      <button
                        type="button"
                        onClick={handleNewChat}
                        aria-label="Start a new chat"
                        className="inline-flex shrink-0 items-center justify-center size-8 -ml-1 rounded-md text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
                      >
                        <Chevron01LeftIcon size={20} />
                      </button>
                      <span className="truncate text-h3 text-ods-text-primary">
                        New Chat
                      </span>
                    </>
                  ) : (
                    <p className="truncate text-h4 text-ods-text-secondary">
                      Start a conversation
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex size-14 shrink-0 items-center justify-center border-l border-ods-border text-ods-text-primary transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
                  aria-label="Close"
                >
                  <XmarkIcon className="text-ods-text-secondary" size={24} />
                </button>
              </div>

              {/* Sidebar + chat-panel row. When Mingo is the active mode and
                  `fetchDialogs` is wired, the in-panel `<ChatSidebar>` lists
                  the user's backend-driven dialog history. Guide mode keeps
                  history in localStorage and currently renders no sidebar. */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {showSidebar && (
                  <ChatSidebar
                    className="w-72 shrink-0"
                    dialogs={dialogs}
                    activeDialogId={activeDialogId ?? undefined}
                    onDialogSelect={handleSelectDialog}
                    onNewChat={() => { void handleStartNewDialog() }}
                    isLoading={isDialogsLoading && dialogs.length === 0}
                    isCreatingDialog={isStartingNewDialog}
                    hasNextPage={hasMoreDialogs}
                    isFetchingNextPage={isDialogsLoading && dialogs.length > 0}
                    onLoadMore={() => { void loadMoreDialogs() }}
                  />
                )}
                <div className="flex flex-1 flex-col min-h-0 min-w-0">

              {showModeToggle ? (
                <div
                  role="radiogroup"
                  aria-label="Chat mode"
                  className="flex-shrink-0 mx-5 mt-3 inline-flex rounded-lg border border-ods-border bg-ods-bg-secondary p-0.5 self-start"
                >
                  {(['mingo', 'guide'] as ChatMode[]).map((m) => {
                    const isActive = activeMode === m
                    const label = m === 'mingo' ? 'Mingo' : 'Guide'
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => handleActiveModeChange(m)}
                        className={
                          'px-3 py-1 text-sm rounded-md transition-colors ' +
                          (isActive
                            ? 'bg-ods-accent text-ods-text-on-accent'
                            : 'text-ods-text-secondary hover:text-ods-text-primary')
                        }
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              <div
                ref={galleryPanelRef}
                className="flex-1 flex flex-col min-h-0 px-5 py-4"
              >
                {hasMessages ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <ChatMessageList
                      messages={messages}
                      isTyping={chatLoading}
                      autoScroll={true}
                      assistantType="mingo"
                      assistantIcon={<MingoIcon className="h-4 w-4" color="white" />}
                      renderEntityCard={renderEntityCard}
                      NavLinkAnchor={NavLinkAnchorViaRuntime}
                      className="flex-1"
                      fullWidth
                    />
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
                ) : (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Figma node 7363:206278 — data-placeholder: logo + greeting.
                        Pinned at the top (flex-shrink-0); the card list below
                        owns its own scroll so the greeting stays visible while
                        users browse the commands. */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-6 p-6 w-full text-center">
                      <MingoIcon
                        className="h-12 w-12"
                        color="white"
                        eyesColor="var(--ods-flamingo-cyan-base)"
                        cornerColor="var(--ods-flamingo-cyan-base)"
                      />
                      <div className="flex flex-col gap-1 w-full">
                        <p className="text-h4 text-ods-text-primary">
                          {userName ? `Hey ${userName}, I'm Mingo` : "Hey, I'm Mingo"}
                        </p>
                        <p className="text-h6 text-ods-text-secondary whitespace-pre-line">
                          {greetingText}
                        </p>
                      </div>
                    </div>

                    {/* Figma node 7363:205938 — single-column slash-command list.
                        The list container has no own bg (inherits the darker
                        `ods-bg` from the drawer panel); each card has the
                        lighter `ods-card` to pop on the dark surface.
                        `flex-1 min-h-0 overflow-y-auto` makes the LIST the
                        scroll target — the rounded-md frame stays visible
                        while inner cards scroll past it. */}
                    {(chipCommands.length > 0 || !commandsLoaded) && (
                      <div className="mx-4 mb-4 flex-1 min-h-0 overflow-y-auto rounded-md border border-ods-border">
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
                          const Icon = resolveOnboardingIcon(cmd.iconName)
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
                  </div>
                )}
              </div>

              <ChatAttachmentChipStrip
                attachments={stagedAttachments}
                onRemove={removeAttachment}
                disabled={chatLoading}
              />

              {/* Figma node 7363:205952 — footer area on the lighter
                  `ods-card` surface to contrast with the darker body
                  (`ods-bg`) above. */}
              <div
                className="flex-shrink-0 px-5 pt-3 pb-4 flex flex-col gap-2 bg-ods-card border-t border-ods-border"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                <ChatFooter className="!p-0" fullWidth>
                  <ChatInput
                    ref={chatInputRef}
                    onSend={handleSend}
                    onStop={stopMessage}
                    sending={chatLoading || hasInflightUploads}
                    placeholder={
                      hasInflightUploads
                        ? 'Waiting for uploads to finish…'
                        : 'Ask a question...'
                    }
                    fullWidth
                    className="px-0"
                    reserveAvatarOffset={false}
                    autoFocus={autoFocusInput}
                    slashCommands={slashCommandsProp}
                  />
                </ChatFooter>

                <div className="flex items-center gap-2 w-full">
                  {attachmentsEnabled && activeMode === 'guide' && (
                    // Attachments are Guide-only: the NATS agent backend
                    // doesn't accept them, so the add-button is hidden in
                    // Mingo mode regardless of the identity endpoint's
                    // capability flag. Skipping the render entirely (not
                    // just the icon) collapses the otherwise-invisible 28px
                    // placeholder slot the component leaves for layout.
                    <ChatAttachmentAddButton
                      attachmentsEnabled
                      attachmentsCount={stagedAttachments.length}
                      onAddFiles={addAttachmentFiles}
                      disabled={chatLoading}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <ModelDisplay
                      provider={currentProvider ?? 'anthropic'}
                      modelName={currentModelLabel ?? 'Claude'}
                      usedTokens={
                        currentInputTokens != null
                          ? (currentInputTokens ?? 0) + (currentOutputTokens ?? 0)
                          : undefined
                      }
                      contextWindow={currentContextWindowMaxTokens ?? undefined}
                      inputTokens={currentInputTokens ?? undefined}
                      outputTokens={currentOutputTokens ?? undefined}
                      hitRatePct={currentCacheHitRatePct ?? undefined}
                      breakdown={currentUsageBreakdown ?? undefined}
                    />
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>
            {galleryModal}
          </>
        )

        // Shell-less branch — host (e.g. AppLayoutDrawer) provides the panel
        // chrome, focus trap, animation, and size. We render only the chat
        // body plus ChatPanelContext so descendants can still close after
        // same-tab navigation via the host's `onOpenChange`.
        if (shellLess) {
          return (
            <ChatPanelContext.Provider value={chatPanelHandle}>
              {body}
            </ChatPanelContext.Provider>
          )
        }

        // Body-level Radix Drawer — backdrop, iOS scroll-lock, focus
        // trap, drag-to-resize handle. Slides in from the right edge.
        return (
          <Drawer open={isOpen} onOpenChange={(o: boolean) => !o && handleClose()}>
            <ChatPanelContext.Provider value={chatPanelHandle}>
              {/*
                Panel-level handle for descendants (inline cards via
                `ChatCardNavWrap`, markdown-body links via
                `NavLinkAnchorViaRuntime`) to close the panel after same-tab
                navigation. Same-tab clicks fire `closeChat`; new-tab clicks
                leave the panel open while the new tab loads.
              */}
              <DrawerContent
                side="right"
                flush
                resizable
                minSize={showSidebar ? 720 : 480}
                maxSize={1600}
                defaultSize={showSidebar ? 960 : 640}
                storageKey={showSidebar ? 'mingo-chat-width-with-sidebar' : 'mingo-chat-width'}
                resizeAriaLabel="Resize chat panel"
                overlayClassName="mingo-chat-overlay md:bg-black/20"
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
      })()}
    </>
  )
}

