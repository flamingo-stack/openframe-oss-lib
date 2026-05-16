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
      reserveAvatarOffset = true,
      disabled = false,
      autoFocus = false,
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
      el.focus()
    }, [disabled])

    useEffect(() => {
      if (autoFocus) {
        focusTextarea()
      }
    }, [autoFocus, focusTextarea])

    // Mirror `value` into a ref so `getValue()` can read the latest value
    // without forcing a new imperative handle on every keystroke. Without
    // this, `useImperativeHandle` deps would have to include `value`,
    // rebuilding the handle object N times per turn.
    const valueRef = useRef(value)
    valueRef.current = value

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
            el.focus()
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
            el.focus()
            el.setSelectionRange(clamped, clamped)
          })
        },
        submit: (next: string) => {
          // Mirror the user-typed Send-button path: skip when sending or
          // disabled, fire onSend with the trimmed value, clear local state.
          // The caller is responsible for any pre-fill UX (none here — this
          // is the one-click "Recent" path).
          if (sending || disabled || !onSend) return
          const trimmed = next.trim()
          if (!trimmed) return
          onSend(trimmed)
          setValue('')
          shouldRefocusRef.current = true
          focusTextarea()
        },
        getValue: () => valueRef.current,
      }),
      // `valueRef` and `shouldRefocusRef` are stable refs. `sending` /
      // `disabled` / `onSend` change session-rarely; including them here
      // is correct for closure freshness and rebuilds < 5 times per chat
      // session — an order of magnitude fewer than per-keystroke.
      [focusTextarea, sending, disabled, onSend],
    )

    const handleSubmit = useCallback(() => {
      const message = value.trim()
      if (message && !sending && !disabled && onSend) {
        onSend(message)
        setValue('')
        shouldRefocusRef.current = true
        focusTextarea()
      }
    }, [value, sending, disabled, onSend, focusTextarea])

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
          el.focus()
          el.setSelectionRange(next.length, next.length)
        })
      },
      [],
    )

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

    if (awaitingResponse) {
      return (
        <div
          className={cn(
            "mx-auto w-full max-w-3xl items-end gap-6",
            reserveAvatarOffset ? "grid grid-cols-[32px_1fr]" : "grid grid-cols-[1fr]",
            "flex-shrink-0",
            className,
          )}
        >
          {reserveAvatarOffset && <div className="invisible h-8 w-8" aria-hidden />}
          <div className="relative flex items-center justify-center gap-2 rounded-md bg-ods-card border border-ods-border px-3 py-3 transition-colors">
            <ChatTypingIndicator size="sm" dotClassName="bg-ods-text-primary" />
            <p className="text-h4 text-ods-text-secondary">Waiting for Technician Response</p>
          </div>
        </div>
      )
    }

    const isStopMode = sending && !!onStop
    const sendDisabled = sending || disabled || !value.trim()

    return (
      <div
        className={cn(
          "mx-auto w-full max-w-3xl items-end gap-6",
          reserveAvatarOffset ? "grid grid-cols-[32px_1fr]" : "grid grid-cols-[1fr]",
          "flex-shrink-0",
          className,
        )}
      >
        {reserveAvatarOffset && <div className="invisible h-8 w-8" aria-hidden />}
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
      </div>
    )
  },
)

ChatInput.displayName = "ChatInput"

export { ChatInput }
