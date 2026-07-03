/**
 * Component prop types
 */

import type { ComponentType, HTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import type { AssistantType, AuthorType, ChatApprovalStatus, ConnectionStatus } from './chat.types'
import type { ApprovalRequestData, Message, MessageSegment, ToolExecutionData } from './message.types'
import type { ChatRef } from '../chat-ref.types'
import type { ChatContextItem } from './context-item.types'

/**
 * Anchor component supplied by the host (or the lib's
 * `NavLinkAnchorViaRuntime`) for markdown links. Receives at minimum
 * `href` / `className` / `children` — what react-markdown's anchor
 * passes. The lib's call site spreads its `rest` via `any`, so
 * implementations are free to declare additional optional routing
 * props (e.g. `path`, `targetPlatform`) without TS forcing the host's
 * NavLinkAnchor prop type to know about them.
 */
export type NavLinkAnchorComponent = ComponentType<{
  href: string
  className?: string
  children?: ReactNode
}>

// ========== Chat Container Props ==========

export interface ChatContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

// ========== Chat Header Props ==========

export interface ChatHeaderTicketInfo {
  title: React.ReactNode
  meta?: React.ReactNode
  status?: string
  /** Lifecycle (custom-status) display name. */
  statusName?: string
  /** Lifecycle (custom-status) hex color, used when the kind isn't canonical. */
  statusColor?: string
  /** Lifecycle (custom-status) kind — drives canonical-vs-color styling. */
  statusKind?: string
}

export interface ChatHeaderProps extends HTMLAttributes<HTMLDivElement> {
  userName?: string
  userTitle?: string
  userAvatar?: string
  userIcon?: React.ReactNode
  onSettingsClick?: () => void
  onNewChat?: () => void
  onClose?: () => void
  onBack?: () => void
  showNewChat?: boolean
  connectionStatus?: ConnectionStatus
  serverUrl?: string | null
  headerActions?: React.ReactNode
  ticketInfo?: ChatHeaderTicketInfo
  /**
   * Drop the default `max-w-ods-content-narrow` (= 600px) constraint so
   * the header fills the entire parent width. Use for chat dialogs
   * embedded in narrow side panels (e.g. the multi-platform-hub
   * `<GlobalAskAI>` panel) where the 600px column would float in the
   * middle of a 720px panel and look misaligned vs the full-width
   * input + content area.
   *
   * Default `false` — preserves the existing centered-narrow layout
   * for legacy consumers.
   */
  fullWidth?: boolean
  /**
   * Drop the default card chrome (bg, border, shadow, ring, rounded) so
   * the header blends with its container. Use when the host shell is
   * already a floating card and the header would otherwise look
   * card-in-card (e.g. inside a `Drawer` with `flush`).
   *
   * Default `false` — preserves the existing card look.
   */
  bare?: boolean
  /**
   * Render a skeleton placeholder in place of the user identity row
   * (avatar/icon + name + server line) while the host is still
   * resolving the assistant/connection data. The skeleton blocks match
   * the real layout's dimensions (64px round avatar, `text-h3` name,
   * `text-h4` server line) so there is no layout shift when the content
   * swaps in.
   *
   * Default `false` — renders the resolved identity row.
   */
  isLoading?: boolean
}

// ========== Connection Indicator Props ==========

export interface ConnectionIndicatorProps {
  status: ConnectionStatus
}

// ========== Chat Message Enhanced Props ==========

export interface ChatMessageEnhancedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  role: 'user' | 'assistant' | 'error'
  content: string | MessageSegment[]
  name?: string
  assistantType?: AssistantType
  authorType?: AuthorType
  assistantIcon?: React.ReactNode
  avatar?: string | null
  timestamp?: Date
  showAvatar?: boolean
  isTyping?: boolean
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  /**
   * Per-row metadata for inline entity-card rendering (v6.1 §B.2.6+§B.2.7).
   * Keyed by `<documentType>:<primaryKey>`. When present AND
   * `renderEntityCard` is also provided, text segments are passed through
   * the `remarkCardLinks` plugin and `[card://<type>:<id>]` markers
   * expand into the host's chosen inline component. When unset (or
   * `renderEntityCard` unset), messages render as plain markdown.
   */
  chatRefs?: Record<string, ChatRef>
  /**
   * Entity-context items attached to this (user) message. When present the
   * bubble renders a read-only chip strip beneath its text (Figma node
   * 31:28709). Resolved from `UnifiedChatMessage.contextItems` by the host.
   */
  contextItems?: ChatContextItem[]
  /**
   * Lead-icon resolver for the context chips (maps an item to its entity-type
   * glyph). Optional — chips render label-only when omitted.
   */
  resolveContextIcon?: (item: ChatContextItem) => ReactNode
  /**
   * Host renderer that REPLACES the default label-only context chip for an
   * attached item with a self-fetching entity chip — so a user's manually
   * attached context renders IDENTICALLY to an inline `@marker:id` mention
   * (same live name resolution, same link). Mirror of `renderMention`, but for
   * the `contextItems` strip instead of inline tokens. Return `null` for an
   * item the host can't render → the lib falls back to the label pill. Keep the
   * function identity stable (module const / `useCallback`) so the message memo
   * holds across streaming chunks.
   */
  renderContextItem?: (item: ChatContextItem) => ReactNode
  /**
   * Host renderer for inline AI mentions `@marker:id` — the ASSISTANT echoing
   * `@device:<machineId>` (etc.) in its reply. DIRECT MIRROR of
   * `renderEntityCard` for the `[card://]` grammar: the lib detects the token
   * (via `remark-mention-chips`), parses `{marker, id}`, and renders whatever
   * node the host returns — typically a SELF-FETCHING chip (each entity type
   * has its own fetcher) that resolves its own display name by id. The lib
   * stays data-agnostic: it knows nothing about entity types or how to fetch
   * them. Return null/undefined for a marker the host can't render → the lib
   * falls back to the bare token text. SEPARATE from `contextItems` (the user's
   * own attachments). Keep the function identity stable (e.g. a module const or
   * `useCallback`) so the message memo holds across streaming chunks.
   */
  renderMention?: (reference: { marker: string; id: string }) => React.ReactNode
  /**
   * Host-provided renderer for inline entity cards (v6.1 §B.2.7 — DRY
   * duplications #2). The OSS-lib delegates all entity-specific rendering
   * (type→icon mapping, hover-card chrome, action buttons, slash-command
   * gating) to the host so the library stays free of app-specific
   * knowledge.
   *
   * Return `null` for any ref the host can't render — the renderer falls
   * back to plain text title-only.
   */
  renderEntityCard?: (reference: ChatRef) => React.ReactNode
  /**
   * Host-provided anchor component for markdown links. When supplied, the
   * `<a>` override in the markdown renderer delegates to this component
   * so the host's unified click rule (e.g. `useNavLink`) owns routing
   * for every link in the message — same-origin → soft RSC nav,
   * cross-origin → new tab, modifier-clicks defer to the browser.
   *
   * Implemented as a component (not a callback) so the host can call its
   * own routing hooks (`useRouter`, doc-tree context, etc.) inside the
   * rendered link. When unset, the OSS-lib falls back to a built-in
   * cross-origin heuristic (same-tab same-origin + `target="_blank"`
   * cross-origin) — duplicated logic, kept for back-compat with hosts
   * that haven't migrated to the prop yet.
   *
   * `card://` markers are still intercepted by the override BEFORE this
   * component runs, so the host need not handle them.
   *
   * Implementations MAY declare additional optional props (e.g.
   * `path`, `targetPlatform` on `NavLinkAnchorViaRuntime`) — react-markdown
   * passes its anchor `rest` props via spread, so undeclared extras
   * simply default to undefined on the receiver.
   */
  NavLinkAnchor?: NavLinkAnchorComponent
}

// ========== Chat Message List Props ==========

export interface ChatMessageListProps extends HTMLAttributes<HTMLDivElement> {
  messages: Message[]
  dialogId?: string
  isLoading?: boolean
  isTyping?: boolean
  typingMessage?: string
  smoothScroll?: boolean
  autoScroll?: boolean
  showAvatars?: boolean
  /** Same `fullWidth` semantics as `ChatHeaderProps.fullWidth` — drops
   *  the inner content wrapper's `max-w-ods-content-narrow` so messages
   *  fill the entire scroller width. Preferred over `contentClassName=
   *  "!max-w-none"` for new consumers (clearer intent, no
   *  `!important` specificity wrestling). */
  fullWidth?: boolean
  /** @deprecated Prefer `fullWidth` for the full-panel-width use case.
   *  This prop remains supported for callers that need a NON-binary
   *  override (custom max-w value, etc.). */
  contentClassName?: string
  assistantType?: AssistantType
  assistantIcon?: React.ReactNode
  pendingApprovals?: MessageSegment[]
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  // Infinite scroll for loading older messages
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  /** Lead-icon resolver for per-message context chips (maps a context item to
   *  its entity-type glyph). Forwarded to every message's ChatMessageEnhanced. */
  resolveContextIcon?: (item: ChatContextItem) => ReactNode
  /** Host renderer that REPLACES the default context chip with a self-fetching
   *  entity chip (so attached context renders like an inline mention).
   *  Forwarded verbatim to every message's ChatMessageEnhanced. */
  renderContextItem?: (item: ChatContextItem) => ReactNode
  /** Host renderer for inline AI mentions `@marker:id` (mirror of
   *  `renderEntityCard`). Forwarded verbatim to every message's
   *  ChatMessageEnhanced; returns a self-fetching chip per entity type. */
  renderMention?: (reference: { marker: string; id: string }) => React.ReactNode
  /** Host-provided renderer for inline entity cards. Forwarded verbatim
   *  to every message's ChatMessageEnhanced. v6.1 §B.2.7. */
  renderEntityCard?: (reference: ChatRef) => React.ReactNode
  /** Host-provided anchor for markdown links. Forwarded verbatim to every
   *  message's ChatMessageEnhanced. Owns the unified click rule
   *  (same-origin soft nav, cross-origin new tab). */
  NavLinkAnchor?: NavLinkAnchorComponent
}

export interface ChatMessageListRef {
  scrollToBottom: (smooth?: boolean) => void
  getScrollPosition: () => { scrollTop: number; scrollHeight: number; clientHeight: number }
  setScrollPosition: (position: { scrollTop: number }) => void
}

// ========== Chat Input Props ==========

/** Action ids — the dispatch BEHAVIORS exposed by a slash command's UI
 *  affordances. The host (e.g. multi-platform-hub) owns the mapping
 *  from id → input-buffer mutation:
 *
 *   - `browse`  : submit `/<id>` bare → top-N items / canonical doc.
 *   - `search`  : prefill `/<id> ` → user types FTS query.
 *   - `find`    : prefill `/<id> ""` (cursor between quotes) → singular
 *                 lookup (ILIKE).
 *   - `display` : prefill `/<id> display ""` (cursor between quotes) →
 *                 server-side intercept reads the matched row's raw
 *                 markdown body verbatim into the chat (no LLM turn).
 *
 *  Mirrors the server-side `SlashCommandActionId` union; kept as a
 *  string-literal union (not enum) so JSON wire shape is stable. */
export type SlashCommandActionId = 'browse' | 'search' | 'find' | 'display'

/** Resolved action affordance — `label` is ALWAYS populated by the
 *  server (override OR default). The OSS-lib renders directly without
 *  label-resolution branching — single source of truth lives in the
 *  hub's `slash-commands-config.ts`. */
export interface SlashCommandSummaryAction {
  id: SlashCommandActionId
  label: string
}

export interface SlashCommandSummary {
  id: string
  description: string
  /** Optional `[arg-name]` hint shown after the command id in autocomplete,
   *  e.g. `/podcasts [title or id]`. Per 2026 best practice (Codex CLI /
   *  Claude Code SDK argument-hint frontmatter). */
  argumentHint?: string
  /** Opaque source id (e.g. `'podcasts'`, `'clickup-roadmap'`) — resolved
   *  by the consumer-provided `resolveSourceIcon` callback into an icon
   *  so the autocomplete row carries the same visual identity as the
   *  empty-state chip. When the resolver returns undefined OR this
   *  field is missing, the row renders without an icon (fallback). */
  primarySourceId?: string
  /** Human-readable command label (e.g. "My Tickets", "Product Releases").
   *  When set, the dropdown row renders this as the bold heading instead
   *  of the raw `primarySourceId` slug. Single source of truth: same
   *  field that backs the empty-state chip's title. Falls back to the
   *  `primarySourceId` slug when undefined. */
  label?: string
  /** Action affordances declared by the server-side registry. The
   *  dropdown row renders one button per entry, in array order. Empty
   *  array = no buttons (degenerate; servers should always declare
   *  ≥1 action). Single source of truth — same array drives the
   *  empty-state chip on the host side via the synchronous registry. */
  actions: SlashCommandSummaryAction[]
  /** Icon-registry key — drives both the empty-state chip glyph AND the
   *  autocomplete dropdown row glyph. Optional; falls back to the
   *  `primarySourceId`-based resolution when missing. */
  iconName?: string
  /** Admin-UI bucket id. */
  category?: string
  /** Empty-state chip-grid sort key. Undefined = NOT a chip (utility /
   *  thematic command — autocomplete dropdown only). Lower = earlier. */
  displayOrder?: number
}

/** Icon + label pair returned by the consumer's `resolveSourceIcon`. The
 *  Icon is a React component (lucide-react or UI-Kit shape); the label
 *  is the human-readable source name (e.g. "Podcasts", "ClickUp Roadmap"). */
export interface SlashCommandSourceMeta {
  Icon: ComponentType<{ className?: string }>
  label: string
}

export interface SlashCommandsProp {
  /** Server-side fetch — typically wraps `GET /api/docs/commands`. The hub
   *  provides this; the OSS-lib has no knowledge of hub route paths. The
   *  chat source is resolved server-side from the calling deployment, so
   *  this callback does NOT take a `source` parameter — passing one would
   *  let a tampered client request a different platform's commands. */
  fetchCommands: (
    prefix: string,
    signal?: AbortSignal,
  ) => Promise<SlashCommandSummary[]>
  /** Optional: resolve a `primarySourceId` to an icon + label pair so the
   *  autocomplete row carries the same visual identity as the empty-state
   *  chip for that source. The host provides this by looking up the
   *  table's icon name and resolving to a React component. Returns
   *  undefined for unknown ids; the row falls back to no-icon rendering. */
  resolveSourceIcon?: (sourceId: string) => SlashCommandSourceMeta | undefined
  /** Generic action handler — fires when the user clicks any of the
   *  command's declared action buttons (Recent / Search / Find / …).
   *  The host owns the mapping from `actionId` to the chat-input-ref
   *  mutation:
   *    - 'browse' → `chatInputRef.current.submit(`/${cmd.id}`)`
   *    - 'search' → `chatInputRef.current.setValue(`/${cmd.id} `)`
   *    - 'find'   → `chatInputRef.current.setValueAndCursor(...)`
   *  When undefined, no action buttons are rendered (the row is still
   *  clickable for the default select behavior). */
  onAction?: (cmd: SlashCommandSummary, actionId: SlashCommandActionId) => void
}

export interface ChatInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  /** Source-compatible widening: returning `false` (or a Promise resolving to
   *  `false`) tells the input to KEEP the draft (e.g. a failed send). `void` /
   *  `true` clears as before — preserves every existing caller's behavior. */
  onSend?: (message: string) => void | boolean | Promise<boolean | void>
  onStop?: () => void | Promise<void>
  sending?: boolean
  awaitingResponse?: boolean
  /** Same `fullWidth` semantics as `ChatHeaderProps.fullWidth` — drops
   *  the default `max-w-ods-content-narrow` so the input fills the
   *  parent. */
  fullWidth?: boolean
  /**
   * @deprecated The avatar-offset layout was removed; this prop is accepted
   * for back-compat but silently ignored. Safe to drop from call sites.
   */
  reserveAvatarOffset?: boolean
  disabled?: boolean
  maxRows?: number
  showSendButton?: boolean
  sendButtonLabel?: string
  /** When provided, shows a slash-command autocomplete dropdown when the
   *  user's text starts with `/`. The dropdown uses UI-Kit `<Card>` + button
   *  primitives (no raw HTML elements) and ODS tokens for theming.
   *  Backward compat: omit to disable autocomplete entirely. */
  slashCommands?: SlashCommandsProp
  /** When true, send is allowed with EMPTY text (e.g. an attachments-only
   *  reply); `onSend('')` fires. Default false → today's text-required gate.
   *  Used by the ticket reply composer so a file-only reply can send. */
  allowEmptySend?: boolean
  /**
   * Enables the `@`-mention trigger for the context picker. Fires with the
   * query typed after a trailing `@token` (e.g. `@dev` → `'dev'`), or `null`
   * when no trigger is active. The composer maps a non-null value to "open
   * the context picker", seeding its type-list filter with the query.
   * Omit to disable the trigger.
   */
  onMentionQueryChange?: (query: string | null) => void
  /**
   * Fires on EVERY draft value change (typing + imperative `setValue` /
   * `commitMention`). The composer uses it to keep `@<type>:<id>` mention
   * tokens in sync with the context chips — when the user deletes the token
   * text, the matching context item is dropped. Pure notification.
   */
  onValueChange?: (value: string) => void
  /** Start adornment rendered inside the textarea's left edge (e.g. the
   *  composer `+` context-menu trigger). Forwarded to `Textarea.startIcon`. */
  startIcon?: ReactNode
  /** Suppress the textarea's own border/bg/radius — an outer card draws it
   *  instead (composer context-chip layout). Forwarded to `Textarea.hideBorder`. */
  hideBorder?: boolean
  /** Ephemeral, non-destructive preview text shown over the editor — e.g.
   *  previewing a hovered quick-action's full prompt before the user commits it.
   *  Purely declarative: it NEVER touches the editor's real value. While set, it
   *  visually replaces the editor (even an in-progress draft); clearing it
   *  (undefined) restores whatever the user had — empty or typed — verbatim. */
  previewText?: string
}

export interface ChatInputRef {
  focus: () => void
  blur: () => void
  clear: () => void
  setValue: (value: string) => void
  getValue: () => string
  /** Set the input value AND position the textarea caret at the given
   *  zero-based offset. Used by the empty-state quick-action "Find"
   *  button that pre-fills `/<cmd> ""` and lands the cursor between
   *  the quotes so the user can immediately start typing the title. */
  setValueAndCursor: (value: string, cursorOffset: number) => void
  /** Set the input value and immediately fire `onSend` with the new
   *  value (subject to the same `sending`/`disabled` guards as a
   *  manual click). Used by the empty-state quick-action "Recent"
   *  button to dispatch `/<cmd>` in one click without forcing the
   *  user to press Enter. */
  submit: (value: string) => void
  /** Strip the active trailing `@token` mention from the draft (preserving any
   *  leading whitespace). Called by the composer after the user picks a
   *  context item / closes the picker so the `@query` scaffolding doesn't get
   *  sent as literal text. No-op when no mention token is active. */
  removeMentionTrigger: () => void
  /** Commit a mention: replace the trailing `@query` being typed with the
   *  literal `@<type>:<id>` token (`token` = `"<type>:<id>"`, plus a trailing
   *  space). MULTIPLE mentions coexist — prior committed tokens are left in
   *  place. The optional `meta` gives the inline chip its display name + icon
   *  (the contenteditable renders the token as a chip); without it the chip
   *  falls back to the id. Used by the composer's `@`-mention flow so the picked
   *  entity rides out in the context — deleting the chip removes it from context. */
  commitMention: (token: string, meta?: MentionMeta) => void
}

/** Display metadata for an inline mention chip rendered inside the composer. */
export interface MentionMeta {
  /** Resolved entity name shown in the chip (e.g. `'ELK-PROD-07'`). */
  label: string
  /** Optional lead icon (entity-type glyph). */
  icon?: ReactNode
}

// ========== Chat Typing Indicator Props ==========

export interface ChatTypingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  text?: string
  name?: string
  dotClassName?: string
}

// ========== Tool Execution Display Props ==========

export interface ToolExecutionDisplayProps extends HTMLAttributes<HTMLDivElement> {
  message: ToolExecutionData
  /** Chat identity. `'fae'` (client) hides the tool icon; `'mingo'`/undefined
   *  keep the admin layout. */
  assistantType?: AssistantType
}

// ========== Approval Request Message Props ==========

export interface ApprovalRequestMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: ApprovalRequestData
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  status?: ChatApprovalStatus
  disabled?: boolean
  /** Chat identity; drives the CLIENT (Fae) styling. Accepted for parity with
   *  the batch card. `'fae'` = client, `'mingo'`/undefined = admin. */
  assistantType?: AssistantType
}

// ========== Error Message Display Props ==========

export interface ErrorMessageDisplayProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  details?: string
  /** Severity — drives the icon tint. Defaults to `error`. */
  type?: 'error' | 'warning' | 'info'
}

// ========== Context Compaction Display Props ==========

export interface ContextCompactionDisplayProps extends HTMLAttributes<HTMLDivElement> {
  status: 'started' | 'completed'
}

// ========== Thinking Display Props ==========

export interface ThinkingDisplayProps extends HTMLAttributes<HTMLDivElement> {
  text: string
  isStreaming?: boolean
}

// ========== Model Display Props ==========

export interface ModelDisplayProps extends HTMLAttributes<HTMLDivElement> {
  provider?: string
  modelName?: string
  displayName?: string
  contextWindow?: number
  usedTokens?: number
  showIcon?: boolean
  /**
   * Per-call token breakdown for the hover-tooltip (v6.1 §A.3). When
   * provided alongside non-empty fields, the entire ModelDisplay is
   * wrapped in a HoverCard trigger that surfaces "Answer model + each
   * helper" rows on hover. Use this for chat surfaces that aggregate a
   * Sonnet answer with Haiku helpers (query rewriter / classifier /
   * summarizer). Absent → renders the bare display unchanged
   * (backward-compatible — every existing caller keeps working).
   */
  breakdown?: ModelUsageBreakdown
  /**
   * Cache-hit % across the answer call's input + cached + creation
   * tokens. Surfaced in the breakdown tooltip's footer. Drives a
   * "cache savings" summary line.
   */
  hitRatePct?: number
  /**
   * Answer call's input tokens — surfaced in the breakdown tooltip's
   * "Answer model" row alongside outputTokens. `usedTokens` (sum) is
   * still the right prop for the inline "X / Y" display; this pair
   * powers the per-row split inside the tooltip.
   */
  inputTokens?: number
  /** Answer call's output tokens — pairs with `inputTokens`. */
  outputTokens?: number
}

/**
 * Cross-call token breakdown captured by the chat route across all
 * Claude calls in a turn (Sonnet answer + Haiku rewriter + Haiku
 * classifier + Haiku summarizer). Every field is optional — chats that
 * skip a helper (e.g., short-conversation summarizer-skipped path) omit
 * the field, and the tooltip just doesn't render that row.
 */
export interface ModelUsageBreakdown {
  haikuRewriter?: { input: number; output: number }
  haikuClassifier?: { input: number; output: number }
  haikuSummarizer?: { input: number; output: number }
}

// ========== Chat Quick Action Props ==========

export interface ChatQuickActionProps extends HTMLAttributes<HTMLButtonElement> {
  text: string
  icon?: React.ReactNode
  onAction?: (text: string) => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  /** Whether this action should show the hint animation */
  isHintActive?: boolean
  /** Callback when user clicks the action - stops hint */
  onHintInteraction?: () => void
  disabled?: boolean
  loading?: boolean
}

// ========== Dialog Item Props ==========

export interface DialogItem {
  id: string
  title: string
  lastMessage?: string
  timestamp?: Date | string
  isActive?: boolean
  unreadMessagesCount?: number
}

// ========== Chat Sidebar Props ==========

export interface ChatSidebarProps extends HTMLAttributes<HTMLDivElement> {
  onNewChat?: () => void
  onDialogSelect?: (dialogId: string) => void
  dialogs?: DialogItem[]
  activeDialogId?: string
  isLoading?: boolean
  isCreatingDialog?: boolean
  children?: React.ReactNode
  // Infinite scroll props
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

// ========== Dialog List Item Props ==========

export interface DialogListItemProps extends HTMLAttributes<HTMLDivElement> {
  dialog: DialogItem
  isActive?: boolean
  onDialogSelect?: (dialogId: string) => void
}