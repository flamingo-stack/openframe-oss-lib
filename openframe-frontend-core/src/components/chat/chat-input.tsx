"use client"

import { useState, useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useMemo, type KeyboardEvent, type ChangeEvent } from "react"
import { cn } from "../../utils/cn"
import { Send01Icon, StopCircleIcon } from "../icons-v2-generated"
import { Textarea } from "../ui/textarea"
import { ChatTypingIndicator } from "./chat-typing-indicator"
import { SlashCommandSuggestions } from "./slash-command-suggestions"
import type { ChatInputProps, ChatInputRef, SlashCommandSummary } from "./types"

/** SHARED with `lib/config/slash-commands-config.ts:SLASH_COMMAND_ID_REGEX`
 *  AND the chat-route slash dispatch parser. Keep all three in sync — server
 *  registration validates against the same shape, so a UI that suggests
 *  uppercase / out-of-charset names would offer commands the API rejects. */
const SLASH_INPUT_TRIGGER = /^\/([a-z][a-z0-9-]*)?$/

/** A COMMITTED `@`-mention token is `@<type>:<id>`. The id can be a base64 /
 *  base64url Relay global id, so the id charset must allow `+ / =` on top of
 *  word chars, `.` and `-` — otherwise the match stops at the first base64 pad
 *  char and the atomic-delete / prior-token strip leave orphaned token text
 *  (which then desyncs the host's chip reconciliation). One shared fragment for
 *  the at-end match (atomic Backspace) and the global strip (commit) keeps them
 *  in lockstep. NOTE: the IN-PROGRESS trigger `@query` (`[\w.-]*`, below) is a
 *  SEPARATE shape — the user types a search string there, never a raw id. */
const MENTION_TOKEN = '@[A-Za-z0-9_.+/=-]+:[A-Za-z0-9_.+/=-]+'
const MENTION_TOKEN_AT_END = new RegExp(`${MENTION_TOKEN}$`)
const MENTION_TOKEN_STRIP = new RegExp(`(^|\\s)${MENTION_TOKEN}`, 'g')

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (allProps, ref) => {
    // Pull `slashCommands` out FIRST, BEFORE any spread, so it can never leak
    // into `<Textarea {...inputProps}>` (and from there onto `<textarea>` as
    // an unrecognized DOM attribute). The structural separation here is the
    // belt to the destructure's suspenders.
    const { slashCommands, ...rest } = allProps
    const {
      className,
      onSend,
      onStop,
      sending = false,
      awaitingResponse = false,
      placeholder = "Enter your Request...",
      // Accepted for back-compat; consumed and discarded so the prop never
      // falls through to the underlying <textarea> as an unknown DOM attr.
      reserveAvatarOffset: _reserveAvatarOffset,
      disabled = false,
      autoFocus = false,
      fullWidth = false,
      // Composer extension — pulled out so it never falls through to the
      // underlying <textarea> as an unknown DOM attribute. `allowEmptySend`
      // lets surfaces that attach files (e.g. the ticket reply composer) send
      // with empty text once an attachment is ready.
      allowEmptySend = false,
      // Pulled out (never spread onto <textarea>): the `@`-mention trigger
      // callback for the context picker.
      onMentionQueryChange,
      // Pulled out (never spread onto <textarea>): fires on EVERY value change
      // (typing + imperative setValue/commitMention). The composer uses it to
      // keep `@type:id` mention tokens in sync with the context chips — delete
      // the token text and its context item drops.
      onValueChange,
      // Start adornment (the composer `+`), forwarded to Textarea.startIcon.
      startIcon,
      // Suppress the textarea's own chrome when an outer card owns it.
      hideBorder,
      ...inputProps
    } = rest

    const [value, setValue] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const shouldRefocusRef = useRef(false)
    const prevSendingRef = useRef(sending)
    const prevAwaitingResponseRef = useRef(awaitingResponse)

    const focusTextarea = useCallback(() => {
      if (disabled) return
      const el = textareaRef.current
      if (!el || el.disabled) return
      // ALWAYS `preventScroll`. Focusing a chat composer must never yank the
      // viewport: in the global Ask-AI chat the input is a sticky, always-
      // visible composer (preventScroll is a no-op there), and in the ticket
      // reply composer the input sits BELOW a tall fixed-height feed — a
      // scroll-on-focus there fights the card's smooth scroll-to-top when the
      // drawer opens. This bit a specific flow: deep-link a ticket → close →
      // reopen, then the post-state-transition refocus effect below fired a
      // bare `focus()` AFTER the card's `window.scrollTo({behavior:'smooth'})`,
      // scrolling the textarea into view and cancelling the smooth animation.
      // `preventScroll` on every focus path removes the whole class of bug.
      el.focus({ preventScroll: true })
    }, [disabled])

    useEffect(() => {
      if (autoFocus) {
        focusTextarea()
      }
    }, [autoFocus, focusTextarea])

    // Surface every value change (typed or imperative) so the composer can
    // reconcile `@type:id` mention tokens with the context chips. Pure
    // notification — never feeds back into this component's state.
    useEffect(() => {
      onValueChange?.(value)
    }, [value, onValueChange])

    // Mirror `value` into a ref so `getValue()` can read the latest value
    // without forcing a new imperative handle on every keystroke. Without
    // this, `useImperativeHandle` deps would have to include `value`,
    // rebuilding the handle object N times per turn.
    const valueRef = useRef(value)
    valueRef.current = value

    // Shared send path for the Send button, Enter key, and imperative submit().
    // Replaces the old eager `setValue('')`: the draft clears ONLY when the send
    // is not rejected (`onSend` returns / resolves !== false), so a failed ticket
    // reply keeps the user's text. `allowEmptySend` lets attachment surfaces send
    // with empty text. Memoized on its gate inputs ONLY (not `value`) so it stays
    // stable across keystrokes — the imperative handle below depends on it without
    // rebuilding per keystroke (preserves the `valueRef` optimization above).
    const fire = useCallback(
      (message: string) => {
        const can = (message.length > 0 || allowEmptySend) && !sending && !disabled
        if (!can || !onSend) return
        const result = onSend(message)
        const done = () => {
          setValue('')
          shouldRefocusRef.current = true
          focusTextarea()
        }
        if (result instanceof Promise) {
          void result.then((ok) => {
            if (ok !== false) done()
          })
        } else if (result !== false) {
          done()
        }
      },
      [allowEmptySend, sending, disabled, onSend, focusTextarea],
    )

    // Expose the `ChatInputRef` shape so parents can imperatively pre-fill
    // the input (used by the empty-state quick-action chips that translate
    // to `/<id> ` slash invocations) and focus the textarea programmatically.
    // setValue() mirrors the user-typed path: updates state AND triggers the
    // textarea's auto-resize on the next frame so multi-line pre-fills don't
    // clip the rendered content.
    useImperativeHandle(
      ref,
      (): ChatInputRef => ({
        focus: () => focusTextarea(),
        blur: () => textareaRef.current?.blur(),
        clear: () => setValue(''),
        setValue: (next: string) => {
          setValue(next)
          // After focus, set selection to the END of the new value —
          // programmatic `.focus()` on a textarea defaults to caret-at-0
          // (browser-standard), which would land the cursor at the start of
          // the prefilled `/cmd ` and force users to arrow-right past every
          // character before typing. Auto-grow is handled by the Textarea's
          // native `field-sizing: content` — no manual height mgmt needed.
          requestAnimationFrame(() => {
            const el = textareaRef.current
            if (!el || disabled || el.disabled) return
            el.focus({ preventScroll: true })
            el.setSelectionRange(next.length, next.length)
          })
        },
        setValueAndCursor: (next: string, cursorOffset: number) => {
          setValue(next)
          // The caret position must be set on the underlying textarea AFTER
          // React commits the new value (otherwise React resets selection
          // to end-of-input on the next render). We clamp the offset to
          // [0, value.length] so a misconfigured caller can't crash.
          const clamped = Math.max(0, Math.min(cursorOffset, next.length))
          requestAnimationFrame(() => {
            const el = textareaRef.current
            if (!el) return
            el.focus({ preventScroll: true })
            el.setSelectionRange(clamped, clamped)
          })
        },
        submit: (next: string) => {
          // Mirror the user-typed Send-button path via the shared `fire` helper
          // (success-gated clear). Reads `next` (its argument), NOT the textarea
          // `value` — the "Recent" quick-action injects a `/cmd` string while
          // `value` is empty, so reading `value` here would submit nothing.
          fire(next.trim())
        },
        getValue: () => valueRef.current,
        removeMentionTrigger: () => {
          // Drop the trailing `@token`, keeping any leading whitespace so the
          // surrounding text stays intact. No-op when nothing matches.
          setValue((v) => v.replace(/(^|\s)@([\w.-]*)$/, '$1'))
        },
        commitMention: (token: string) => {
          // Single-select: replace the trailing `@query` the user is typing
          // with the committed `@<type>:<id>` token (+ trailing space), AND
          // strip any previously committed token so only ONE mention reference
          // ever lives in the text. The trailing space dismisses the mention
          // trigger (the `@…$` detector needs no trailing whitespace), so the
          // picker closes on its own. The colon also keeps the committed token
          // out of `removeMentionTrigger`'s `@[\w.-]*$` match.
          setValue((v) => {
            const stripped = v.replace(MENTION_TOKEN_STRIP, '$1')
            const next = /(^|\s)@([\w.-]*)$/.test(stripped)
              ? stripped.replace(/(^|\s)@([\w.-]*)$/, `$1@${token} `)
              : `${stripped}${stripped.length > 0 && !stripped.endsWith(' ') ? ' ' : ''}@${token} `
            // Stripping a mid-text token leaves its surrounding spaces behind
            // (a double space, or a leading space when it was first). Collapse
            // runs of horizontal whitespace and drop any leading space — but
            // preserve newlines and the single trailing space (which dismisses
            // the `@`-mention trigger so the picker closes on its own).
            return next.replace(/[^\S\n]{2,}/g, ' ').replace(/^[^\S\n]+/, '')
          })
          requestAnimationFrame(() => {
            const el = textareaRef.current
            if (!el || disabled || el.disabled) return
            el.focus({ preventScroll: true })
            el.setSelectionRange(el.value.length, el.value.length)
          })
        },
      }),
      // `valueRef` and `shouldRefocusRef` are stable refs. `disabled` (read by
      // `setValue`'s rAF guard) and `focusTextarea` change session-rarely; `fire`
      // is memoized on its gate inputs (`sending`/`onSend`/`allowEmptySend` all
      // live inside it), so the handle rebuilds only when those change — still
      // far fewer than per-keystroke.
      [focusTextarea, disabled, fire],
    )

    // The Enter key calls handleSubmit directly (bypassing the Send button's
    // per-render `sendDisabled`), so it must read a fresh gate — `fire` is
    // memoized on every gate input, so depending on `fire` + `value` is both
    // fresh and exhaustive-deps-clean.
    const handleSubmit = useCallback(() => {
      fire(value.trim())
    }, [fire, value])

    // `@`-mention trigger detection. Matches a trailing `@token` preceded by
    // start-of-text or whitespace (so emails like `foo@bar` never trigger).
    // `@` alone yields an empty query (open the picker unfiltered). A trailing
    // space dismisses the trigger. Enabled only when the host wires the
    // callback.
    const mentionEnabled = !!onMentionQueryChange
    const mentionQuery = useMemo(() => {
      if (!mentionEnabled) return null
      const m = value.match(/(?:^|\s)@([\w.-]*)$/)
      return m ? (m[1] ?? '') : null
    }, [value, mentionEnabled])

    // Surface the active mention query (or null) to the composer, which maps
    // a non-null value to "open the context picker".
    useEffect(() => {
      if (mentionEnabled) onMentionQueryChange?.(mentionQuery)
    }, [mentionEnabled, mentionQuery, onMentionQueryChange])

    // Slash-command autocomplete state. Detection runs in render so the
    // keyboard handler can branch on it without re-parsing.
    const slashMatch = useMemo(
      () => (slashCommands ? value.match(SLASH_INPUT_TRIGGER) : null),
      [value, slashCommands],
    )
    const slashPrefix = slashMatch ? slashMatch[1] ?? '' : null
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
          // `fetchCommands` resolves the chat source server-side from
          // the calling deployment's `NEXT_PUBLIC_APP_TYPE` (via
          // `getCurrentChatSource()` in the host's route base). No
          // `source` argument crosses the wire — preventing cross-
          // platform command enumeration from the autocomplete path.
          const next = await slashCommands.fetchCommands(slashPrefix, ctrl.signal)
          if (!cancelled) {
            setSlashSuggestions(next)
            setHighlightedIdx(0)
          }
        } catch (err) {
          // AbortError on dep-change / unmount is expected.
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

    const acceptSuggestion = useCallback(
      (cmd: SlashCommandSummary) => {
        // Keep trailing space so the user types args without an extra space.
        // Matches macOS / VSCode autocomplete UX.
        const next = `/${cmd.id} `
        setValue(next)
        setSlashSuggestions([])
        // After focus, position the caret at the end of the prefilled
        // string. Programmatic `.focus()` defaults to caret-at-0 in most
        // browsers, which would force the user to arrow-right past every
        // prefilled character before typing args. Defer one frame so the
        // textarea has the new value committed by React first.
        requestAnimationFrame(() => {
          const el = textareaRef.current
          if (!el || el.disabled) return
          el.focus({ preventScroll: true })
          el.setSelectionRange(next.length, next.length)
        })
      },
      [],
    )

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Atomic mention delete: one Backspace removes a whole committed
        // `@<type>:<id>` token when the caret sits RIGHT AFTER the token's last
        // char — so a mention reads/deletes like a single chip, not 12 chars.
        // The trailing space after a committed token is NOT part of the match,
        // so a Backspace there deletes just the space (normal editing); the
        // atomic wipe only fires on the mention's own characters. Only with no
        // active selection and the context feature on; a committed token can't
        // appear inside a `/slash` or `@query` prefix, so sitting before the
        // slash/mention branches is safe (no match → fall through). The removal
        // flows through `setValue`, so `onValueChange` fires and the host drops
        // the matching context chip.
        if (mentionEnabled && e.key === 'Backspace') {
          const el = textareaRef.current
          if (el && el.selectionStart === el.selectionEnd && el.selectionStart > 0) {
            const caret = el.selectionStart
            const before = value.slice(0, caret)
            const m = before.match(MENTION_TOKEN_AT_END)
            if (m && m.index !== undefined) {
              e.preventDefault()
              const pos = m.index
              setValue(value.slice(0, pos) + value.slice(caret))
              requestAnimationFrame(() => {
                const t = textareaRef.current
                if (!t) return
                t.setSelectionRange(pos, pos)
              })
              return
            }
          }
        }

        // Slash-command navigation takes precedence when the dropdown is
        // visible. Esc closes; ArrowUp/Down cycle; Tab/Enter accept.
        if (slashSuggestions.length > 0 && slashPrefix !== null) {
          if (e.key === 'Escape') {
            e.preventDefault()
            setSlashSuggestions([])
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIdx((i) => (i + 1) % slashSuggestions.length)
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIdx(
              (i) => (i - 1 + slashSuggestions.length) % slashSuggestions.length,
            )
            return
          }
          if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
            e.preventDefault()
            const sel = slashSuggestions[highlightedIdx]
            if (sel) acceptSuggestion(sel)
            return
          }
        }

        // While the `@`-mention trigger is active the context picker owns the
        // intent: Escape dismisses the trigger (which closes the picker via
        // the value-change effect); Enter must NOT send (the user is mid-pick,
        // and items are chosen by click). Both are swallowed here.
        if (mentionQuery !== null) {
          if (e.key === 'Escape') {
            e.preventDefault()
            setValue((v) => v.replace(/(^|\s)@([\w.-]*)$/, '$1'))
            return
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            return
          }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSubmit()
        }
      },
      [
        slashSuggestions,
        slashPrefix,
        highlightedIdx,
        acceptSuggestion,
        handleSubmit,
        mentionQuery,
        mentionEnabled,
        value,
      ],
    )

    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
    }, [])

    const [isStopping, setIsStopping] = useState(false)

    useEffect(() => {
      if (!sending) {
        setIsStopping(false)
      }
    }, [sending])

    useEffect(() => {
      const wasSending = prevSendingRef.current
      prevSendingRef.current = sending
      if (wasSending && !sending && shouldRefocusRef.current && !awaitingResponse && !disabled) {
        shouldRefocusRef.current = false
        focusTextarea()
      }
    }, [sending, awaitingResponse, disabled, focusTextarea])

    useEffect(() => {
      const wasAwaiting = prevAwaitingResponseRef.current
      prevAwaitingResponseRef.current = awaitingResponse
      if (wasAwaiting && !awaitingResponse && shouldRefocusRef.current && !disabled) {
        shouldRefocusRef.current = false
        const id = requestAnimationFrame(() => focusTextarea())
        return () => cancelAnimationFrame(id)
      }
    }, [awaitingResponse, disabled, focusTextarea])

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
    // Send gate: `allowEmptySend` lets empty text send (attachments-only).
    // Default (false) collapses to the original `!value.trim()` gate.
    const hasContent = value.trim().length > 0 || allowEmptySend
    const sendDisabled = sending || disabled || !hasContent

    return (
      <div
        className={cn(
          // `fullWidth=true` drops the centered-narrow content column
          // for chats hosted in side panels; default preserves the
          // legacy 600px max-width for existing consumers.
          fullWidth
            ? "w-full flex-shrink-0"
            : "mx-auto w-full max-w-ods-content-narrow flex-shrink-0",
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
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Connection lost. Waiting to reconnect..." : placeholder}
              disabled={sending || disabled}
              rows={1}
              startIcon={startIcon}
              hideBorder={hideBorder}
              endIcon={isStopMode ? <StopCircleIcon size={20} /> : <Send01Icon size={20} />}
              endIconAsButton
              endIconButtonProps={{
                onClick: isStopMode ? handleStop : handleSubmit,
                disabled: isStopMode ? isStopping : sendDisabled,
                'aria-label': isStopMode ? 'Stop generation' : 'Send message',
              }}
              {...inputProps}
            />
          </div>
        )}
      </div>
    )
  },
)

ChatInput.displayName = "ChatInput"

export { ChatInput }
