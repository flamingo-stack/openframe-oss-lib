"use client"

import { useState, useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useMemo, type ReactNode, type KeyboardEvent, type ClipboardEvent } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { cn } from "../../utils/cn"
import { Send01Icon, StopCircleIcon } from "../icons-v2-generated"
import { Tag } from "../ui/tag"
import { ChatTypingIndicator } from "./chat-typing-indicator"
import { SlashCommandSuggestions } from "./slash-command-suggestions"
import type { ChatInputProps, ChatInputRef, MentionMeta, SlashCommandSummary } from "./types"

/** SHARED with `lib/config/slash-commands-config.ts` AND the chat-route slash
 *  dispatch parser. Keep all three in sync. */
const SLASH_INPUT_TRIGGER = /^\/([a-z][a-z0-9-]*)?$/

/** A committed `@`-mention serializes into the draft text as `@<marker>:<id>`
 *  (id charset allows `+ / = . -` for base64 Relay global ids). The editor
 *  renders each such token as an inline chip; the serialized string keeps the
 *  literal token so the host's `@type:id` reconciliation + send payload are
 *  unchanged. */
const MENTION_GLOBAL = /@[A-Za-z0-9_.+/=-]+:[A-Za-z0-9_.+/=-]+/g
/** The IN-PROGRESS trigger being typed — `@` + search string at the END of the
 *  draft, preceded by start-of-text or whitespace (so emails never fire). */
const MENTION_TRIGGER_AT_END = /(^|\s)@([\w.-]*)$/

type Segment = { kind: 'text'; text: string } | { kind: 'mention'; token: string; label: string; icon?: ReactNode }

function parseSegments(value: string, meta: Map<string, MentionMeta>): Segment[] {
  const segs: Segment[] = []
  let last = 0
  MENTION_GLOBAL.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MENTION_GLOBAL.exec(value)) !== null) {
    if (m.index > last) segs.push({ kind: 'text', text: value.slice(last, m.index) })
    const token = m[0].slice(1)
    const info = meta.get(token)
    segs.push({ kind: 'mention', token, label: info?.label ?? token.slice(token.indexOf(':') + 1), icon: info?.icon })
    last = m.index + m[0].length
  }
  if (last < value.length) segs.push({ kind: 'text', text: value.slice(last) })
  return segs
}

const isChip = (n: Node): n is HTMLElement => n.nodeType === 1 && (n as HTMLElement).dataset?.token !== undefined

/** Serialize the editor DOM back to the draft string: text nodes verbatim,
 *  mention chips → `@<token>`, browser-inserted `<br>` ignored (newlines live as
 *  literal `\n` text via `white-space: pre-wrap`). Chips are atomic
 *  (`contentEditable=false`) so we never descend into their inner markup. */
function serialize(el: HTMLElement): string {
  let out = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? ''
    else if (isChip(node)) out += `@${(node as HTMLElement).dataset.token}`
    else if ((node as HTMLElement).tagName === 'BR') continue
    else out += node.textContent ?? ''
  }
  return out
}

/** Build a mention chip as a plain (React-free) DOM node — the editor is an
 *  UNCONTROLLED contenteditable, so chips must be real DOM the browser owns
 *  (atomically deletable, never reconciled by React). We REUSE the lib `Tag`
 *  (`variant="badge"` + its built-in `onClose` ⊗) by rendering it to static
 *  markup; the outer wrapper carries `data-token`/`contenteditable=false`, and
 *  the close button is wired via a delegated click on the editor (events don't
 *  survive static markup). */
function buildChipEl(token: string, label: string, icon?: ReactNode): HTMLElement {
  const span = document.createElement('span')
  span.dataset.token = token
  span.setAttribute('contenteditable', 'false')
  // Center the chip in its line box DETERMINISTICALLY (independent of font
  // metrics): `vertical-align: middle` references the text baseline + x-height,
  // not the geometric line-box center, so it leaves the chip ~2px low. Instead
  // make the wrapper exactly one line box tall (`h-9` == editor `leading-9`,
  // 36px) and `align-top` (pure geometric: wrapper top == line-box top, no
  // baseline offset), then center the shorter chip inside via `items-center`.
  span.className = 'mx-0.5 inline-flex h-9 items-center select-none align-top'
  span.innerHTML = renderToStaticMarkup(
    <Tag
      as="span"
      variant="badge"
      icon={icon}
      label={label}
      onClose={() => {}}
      // Match the context-chip pill, not the badge defaults: muted (grey) lead
      // icon + ⊗ instead of white (`text-ods-text-primary` stays on the label
      // only), and NO accent-yellow border on hover.
      className="max-w-[16rem] hover:border-ods-border [&_svg]:text-ods-text-secondary"
    />,
  )
  return span
}

/** Replace the editor's content with text nodes + chips parsed from `value`. */
function rebuildDom(el: HTMLElement, value: string, meta: Map<string, MentionMeta>): void {
  el.replaceChildren()
  for (const seg of parseSegments(value, meta)) {
    if (seg.kind === 'text') el.appendChild(document.createTextNode(seg.text))
    else el.appendChild(buildChipEl(seg.token, seg.label, seg.icon))
  }
}

function placeCaretAtEnd(el: HTMLElement): void {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Place the caret at a character offset in a PLAIN-text editor (no chips) —
 *  used only by `setValueAndCursor` (slash prefill). */
function placeCaretAtOffset(el: HTMLElement, offset: number): void {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel) return
  const node = el.firstChild
  const range = document.createRange()
  if (node && node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, Math.max(0, Math.min(offset, node.textContent?.length ?? 0)))
    range.collapse(true)
  } else {
    range.selectNodeContents(el)
    range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Insert plain text at the caret as a real text node (paste / Shift+Enter), so
 *  no `<br>`/`<div>` ever enters the DOM and serialization stays deterministic. */
function insertTextAtCaret(text: string): void {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const tn = document.createTextNode(text)
  range.insertNode(tn)
  range.setStartAfter(tn)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>((allProps, ref) => {
  const { slashCommands, ...rest } = allProps
  const {
    className,
    onSend,
    onStop,
    sending = false,
    awaitingResponse = false,
    placeholder = "Enter your Request...",
    reserveAvatarOffset: _reserveAvatarOffset,
    disabled = false,
    autoFocus = false,
    fullWidth = false,
    allowEmptySend = false,
    onMentionQueryChange,
    onValueChange,
    startIcon,
    hideBorder,
    // Remaining textarea-only attrs are intentionally dropped — the editor is a
    // contenteditable div, not a <textarea>, so spreading them would warn.
  } = rest as typeof rest & { rows?: number }

  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const shouldRefocusRef = useRef(false)
  const prevSendingRef = useRef(sending)
  const prevAwaitingResponseRef = useRef(awaitingResponse)
  const isComposingRef = useRef(false)
  // Live mirror of the value + committed-chip meta for sync reads inside the
  // stable imperative handle (no rebuild of the handle per keystroke).
  const valueRef = useRef(value)
  valueRef.current = value
  const metaRef = useRef<Map<string, MentionMeta>>(new Map())

  const focusEditor = useCallback(() => {
    if (disabled) return
    editorRef.current?.focus({ preventScroll: true })
  }, [disabled])

  useEffect(() => {
    if (autoFocus) focusEditor()
  }, [autoFocus, focusEditor])

  // Surface every value change (typed or imperative) so the composer reconciles
  // `@type:id` mention chips with the context items.
  useEffect(() => {
    onValueChange?.(value)
  }, [value, onValueChange])

  // Apply a NEW draft value to BOTH the DOM (imperative rebuild) and state. Used
  // by every imperative mutation (commit, setValue, clear, remove). Typing does
  // NOT go through here — the browser owns the DOM and we only read it back.
  const applyValue = useCallback((next: string, caret: 'end' | number = 'end') => {
    const el = editorRef.current
    if (el) {
      rebuildDom(el, next, metaRef.current)
      if (document.activeElement === el || caret === 'end') {
        if (typeof caret === 'number') placeCaretAtOffset(el, caret)
        else placeCaretAtEnd(el)
      }
    }
    setValue(next)
  }, [])

  // ── send ──────────────────────────────────────────────────────────────────
  const fire = useCallback(
    (message: string) => {
      const can = (message.length > 0 || allowEmptySend) && !sending && !disabled
      if (!can || !onSend) return
      const result = onSend(message)
      const done = () => {
        metaRef.current = new Map()
        applyValue('')
        shouldRefocusRef.current = true
        focusEditor()
      }
      if (result instanceof Promise) {
        void result.then((ok) => {
          if (ok !== false) done()
        })
      } else if (result !== false) {
        done()
      }
    },
    [allowEmptySend, sending, disabled, onSend, focusEditor, applyValue],
  )

  const handleSubmit = useCallback(() => {
    fire(valueRef.current.trim())
  }, [fire])

  useImperativeHandle(
    ref,
    (): ChatInputRef => ({
      focus: () => focusEditor(),
      blur: () => editorRef.current?.blur(),
      clear: () => {
        metaRef.current = new Map()
        applyValue('')
      },
      setValue: (next: string) => {
        applyValue(next)
        requestAnimationFrame(() => focusEditor())
      },
      setValueAndCursor: (next: string, cursorOffset: number) => {
        applyValue(next, Math.max(0, Math.min(cursorOffset, next.length)))
        requestAnimationFrame(() => focusEditor())
      },
      submit: (next: string) => fire(next.trim()),
      getValue: () => valueRef.current,
      removeMentionTrigger: () => {
        applyValue(valueRef.current.replace(MENTION_TRIGGER_AT_END, '$1'))
      },
      commitMention: (token: string, meta?: MentionMeta) => {
        // Multi-select: replace the trailing `@query` being typed with the
        // committed `@<token> ` (+ trailing space → dismisses the trigger so the
        // picker closes; also gives the caret a text node to land in after the
        // chip). Prior committed mentions stay — several chips coexist.
        if (meta) metaRef.current = new Map(metaRef.current).set(token, meta)
        const v = valueRef.current
        const next = MENTION_TRIGGER_AT_END.test(v)
          ? v.replace(MENTION_TRIGGER_AT_END, `$1@${token} `)
          : `${v}${v.length > 0 && !v.endsWith(' ') ? ' ' : ''}@${token} `
        applyValue(next)
        requestAnimationFrame(() => focusEditor())
      },
    }),
    [focusEditor, fire, applyValue],
  )

  // ── `@`-mention trigger detection ───────────────────────────────────────────
  const mentionEnabled = !!onMentionQueryChange
  const mentionQuery = useMemo(() => {
    if (!mentionEnabled) return null
    const m = value.match(MENTION_TRIGGER_AT_END)
    return m ? (m[2] ?? '') : null
  }, [value, mentionEnabled])

  useEffect(() => {
    if (mentionEnabled) onMentionQueryChange?.(mentionQuery)
  }, [mentionEnabled, mentionQuery, onMentionQueryChange])

  // ── slash-command autocomplete ──────────────────────────────────────────────
  const slashMatch = useMemo(() => (slashCommands ? value.match(SLASH_INPUT_TRIGGER) : null), [value, slashCommands])
  const slashPrefix = slashMatch ? (slashMatch[1] ?? '') : null
  const [slashSuggestions, setSlashSuggestions] = useState<SlashCommandSummary[]>([])
  const [highlightedIdx, setHighlightedIdx] = useState(0)

  useEffect(() => {
    if (slashPrefix == null || !slashCommands) {
      setSlashSuggestions([])
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const next = await slashCommands.fetchCommands(slashPrefix, ctrl.signal)
        if (!cancelled) {
          setSlashSuggestions(next)
          setHighlightedIdx(0)
        }
      } catch (err) {
        if (!cancelled && (err as Error)?.name !== 'AbortError') {
          console.warn('[chat-input] slash-command fetch failed:', err)
        }
      }
    }, 150)
    return () => {
      cancelled = true
      ctrl.abort()
      clearTimeout(handle)
    }
  }, [slashPrefix, slashCommands])

  const acceptSuggestion = useCallback((cmd: SlashCommandSummary) => {
    metaRef.current = new Map()
    const next = `/${cmd.id} `
    applyValue(next, next.length)
    setSlashSuggestions([])
    requestAnimationFrame(() => focusEditor())
  }, [applyValue, focusEditor])

  // ── editor events ───────────────────────────────────────────────────────────
  const syncFromDom = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    setValue(serialize(el))
  }, [])

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return // mid-IME: the browser owns the DOM
    syncFromDom()
  }, [syncFromDom])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    insertTextAtCaret(text)
    syncFromDom()
  }, [syncFromDom])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (slashSuggestions.length > 0 && slashPrefix !== null) {
        if (e.key === 'Escape') { e.preventDefault(); setSlashSuggestions([]); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx((i) => (i + 1) % slashSuggestions.length); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIdx((i) => (i - 1 + slashSuggestions.length) % slashSuggestions.length); return }
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault()
          const sel = slashSuggestions[highlightedIdx]
          if (sel) acceptSuggestion(sel)
          return
        }
      }

      if (mentionQuery !== null) {
        if (e.key === 'Escape') { e.preventDefault(); applyValue(valueRef.current.replace(MENTION_TRIGGER_AT_END, '$1')); return }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); return }
      }

      if (e.key === 'Enter') {
        if (e.shiftKey) {
          e.preventDefault()
          insertTextAtCaret('\n')
          syncFromDom()
        } else {
          e.preventDefault()
          handleSubmit()
        }
      }
    },
    [slashSuggestions, slashPrefix, highlightedIdx, acceptSuggestion, handleSubmit, mentionQuery, applyValue, syncFromDom],
  )

  // Delegated remove: a click on a chip's ⊗ (Tag's `onClose` button, inside a
  // `[data-token]` wrapper). Strip that token from the draft → value change →
  // host drops the matching context item.
  const handleEditorMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const chip = target.closest<HTMLElement>('[data-token]')
    if (!chip || !target.closest('button')) return
    e.preventDefault() // keep editor focus; don't move the caret into the chip
    const token = chip.dataset.token ?? ''
    const next = valueRef.current
      .replace(`@${token} `, '')
      .replace(`@${token}`, '')
      .replace(/[^\S\n]{2,}/g, ' ')
      .replace(/^[^\S\n]+/, '')
    applyValue(next)
    requestAnimationFrame(() => focusEditor())
  }, [applyValue, focusEditor])

  // ── refocus after send/await transitions ────────────────────────────────────
  useEffect(() => { if (!sending) setIsStopping(false) }, [sending])
  useEffect(() => {
    const wasSending = prevSendingRef.current
    prevSendingRef.current = sending
    if (wasSending && !sending && shouldRefocusRef.current && !awaitingResponse && !disabled) {
      shouldRefocusRef.current = false
      focusEditor()
    }
  }, [sending, awaitingResponse, disabled, focusEditor])
  useEffect(() => {
    const wasAwaiting = prevAwaitingResponseRef.current
    prevAwaitingResponseRef.current = awaitingResponse
    if (wasAwaiting && !awaitingResponse && shouldRefocusRef.current && !disabled) {
      shouldRefocusRef.current = false
      const id = requestAnimationFrame(() => focusEditor())
      return () => cancelAnimationFrame(id)
    }
  }, [awaitingResponse, disabled, focusEditor])

  const handleStop = useCallback(async () => {
    if (!onStop || isStopping) return
    setIsStopping(true)
    try {
      await onStop()
    } catch {
      setIsStopping(false)
    }
  }, [onStop, isStopping])

  const isStopMode = sending && !!onStop
  const hasContent = value.trim().length > 0 || allowEmptySend
  const sendDisabled = sending || disabled || !hasContent
  const isEmpty = value.length === 0
  const isDisabled = sending || disabled

  return (
    <div
      className={cn(
        fullWidth ? "w-full flex-shrink-0" : "mx-auto w-full max-w-ods-content-narrow flex-shrink-0",
        className,
      )}
    >
      {awaitingResponse ? (
        <div className="relative flex items-center justify-center gap-[var(--spacing-system-xs)] rounded-md bg-ods-card border border-ods-border px-[var(--spacing-system-s)] py-[var(--spacing-system-s)] transition-colors">
          <ChatTypingIndicator size="sm" dotClassName="bg-ods-text-primary" />
          <p className="text-h4 text-ods-text-secondary">Waiting for Technician Response</p>
        </div>
      ) : (
        <div className="relative">
          <SlashCommandSuggestions
            commands={slashPrefix !== null ? slashSuggestions : []}
            highlightedIdx={highlightedIdx}
            onHover={setHighlightedIdx}
            onSelect={acceptSuggestion}
            resolveSourceIcon={slashCommands?.resolveSourceIcon}
            onAction={slashCommands?.onAction}
          />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: focus proxy for the contenteditable; keyboard users focus the editor directly. */}
          <div
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                focusEditor()
              }
            }}
            className={cn(
              // `items-center` keeps the empty single-line text AND a mention chip
              // vertically centered the same way. `py-1.5` (6px) pairs with the
              // editor's `leading-9` (36px) → a single line is exactly 48px
              // (36 + 2*6). The 36px line box is just barely above the 32px chip
              // (incl. its ~3.5px vertical-align overhead), so there's almost no
              // slack for the chip to drift in → it reads as centered, and the row
              // never overflows past 48px.
              "flex w-full items-center gap-2 px-3 py-1.5 min-h-11 md:min-h-12 cursor-text group transition-colors duration-200",
              !hideBorder && "rounded-[6px] border bg-ods-card border-ods-border",
              !hideBorder && (focused ? "border-ods-accent" : !isDisabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover"),
              !hideBorder && isDisabled && "!cursor-not-allowed bg-ods-bg",
              hideBorder && "bg-transparent",
            )}
          >
            {startIcon && <span className="flex h-6 shrink-0 items-center">{startIcon}</span>}

            <div className="relative flex-1 min-w-0">
              {isEmpty && (
                <span className="pointer-events-none absolute left-0 top-0 select-none text-h4 !leading-9 text-ods-text-secondary">
                  {disabled ? "Connection lost. Waiting to reconnect..." : placeholder}
                </span>
              )}
              {/* UNCONTROLLED contenteditable: React renders it WITHOUT children
                  and never reconciles its content — all text/chips are managed
                  imperatively (browser owns typing/delete; we own chip insert). */}
              {/* biome-ignore lint/a11y/useFocusableInteractive: role=textbox on a contenteditable is focusable. */}
              {/* biome-ignore lint/a11y/useSemanticElements: contenteditable rich input has no native element. */}
              <div
                ref={editorRef}
                data-editor
                role="textbox"
                aria-multiline="true"
                aria-label={typeof placeholder === 'string' ? placeholder : 'Message'}
                contentEditable={!isDisabled}
                suppressContentEditableWarning
                spellCheck
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onMouseDown={handleEditorMouseDown}
                onCompositionStart={() => { isComposingRef.current = true }}
                onCompositionEnd={() => { isComposingRef.current = false; syncFromDom() }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className={cn(
                  "max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words outline-none",
                  // `leading-9` (36px) sits just above the 32px chip's line-box need
                  // (~35.5px incl. vertical-align overhead): the LINE drives row
                  // height (deterministic 48px, no overflow) AND the near-zero slack
                  // keeps the chip centered. ~4px gap between wrapped chip rows.
                  "text-h4 text-ods-text-primary !leading-9",
                  "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
                  isDisabled && "cursor-not-allowed",
                )}
              />
            </div>

            <button
              type="button"
              aria-label={isStopMode ? 'Stop generation' : 'Send message'}
              onClick={isStopMode ? handleStop : handleSubmit}
              disabled={isStopMode ? isStopping : sendDisabled}
              className={cn(
                "flex h-6 shrink-0 items-center text-ods-text-secondary transition-colors duration-200",
                focused && "text-ods-accent",
                "[&_svg]:size-4 md:[&_svg]:size-6",
                "cursor-pointer hover:text-ods-text-primary",
                "focus-visible:outline-none focus-visible:text-ods-accent",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ods-text-secondary",
              )}
            >
              {isStopMode ? <StopCircleIcon size={20} /> : <Send01Icon size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

ChatInput.displayName = "ChatInput"

export { ChatInput }
