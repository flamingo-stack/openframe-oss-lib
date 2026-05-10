"use client"

import { useState, useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useMemo, type KeyboardEvent, type ChangeEvent } from "react"
import { cn } from "../../utils/cn"
import { Send01Icon, StopIcon } from "../icons-v2-generated"
import { Textarea } from "../ui/textarea"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { ChatTypingIndicator } from "./chat-typing-indicator"
import type { ChatInputProps, SlashCommandSummary } from "./types"

/** SHARED with `lib/config/slash-commands-config.ts:SLASH_COMMAND_ID_REGEX`
 *  AND the chat-route slash dispatch parser. Keep all three in sync — server
 *  registration validates against the same shape, so a UI that suggests
 *  uppercase / out-of-charset names would offer commands the API rejects. */
const SLASH_INPUT_TRIGGER = /^\/([a-z][a-z0-9-]*)?$/

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ className, onSend, onStop, sending = false, awaitingResponse = false, placeholder = "Enter your Request...", reserveAvatarOffset = true, disabled = false, autoFocus = false, slashCommands, ...props }, ref) => {
    const [value, setValue] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const shouldRefocusRef = useRef(false)
    const prevSendingRef = useRef(sending)
    const prevAwaitingResponseRef = useRef(awaitingResponse)

    useImperativeHandle(ref, () => textareaRef.current!)

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

    const handleSubmit = useCallback(() => {
      const message = value.trim()
      if (message && !sending && !disabled && onSend) {
        onSend(message)
        setValue('')

        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }

        shouldRefocusRef.current = true
        focusTextarea()
      }
    }, [value, sending, disabled, onSend, focusTextarea])

    // Slash-command autocomplete state. Detect trigger BEFORE keydown handler
    // so Enter behavior (submit vs. accept-suggestion) can branch on it.
    // The optional `?` in the regex captures the empty-prefix case where the
    // user has typed only `/`.
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
          const next = await slashCommands.fetchCommands(
            slashCommands.source,
            slashPrefix,
            ctrl.signal,
          )
          if (!cancelled) {
            setSlashSuggestions(next)
            setHighlightedIdx(0)
          }
        } catch (err) {
          // AbortError on dep-change / unmount is expected.
          if (!cancelled && (err as Error)?.name !== 'AbortError') {
            // Silent fail in production — autocomplete is non-critical.
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
        // Keep the trailing space so the user can type args without having
        // to press space after Tab. Matches macOS / VSCode autocomplete UX.
        setValue(`/${cmd.id} `)
        setSlashSuggestions([])
        focusTextarea()
      },
      [focusTextarea],
    )

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Slash-command navigation takes precedence when the dropdown is
        // visible. Esc closes; ArrowUp/Down cycle; Enter/Tab accept.
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

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
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

    // Show awaiting response state
    if (awaitingResponse) {
      return (
        <div
          className={cn(
            "mx-auto w-full max-w-3xl items-end gap-6",
            reserveAvatarOffset ? "grid grid-cols-[32px_1fr]" : "grid grid-cols-[1fr]",
            "flex-shrink-0",
            className
          )}
        >
          {reserveAvatarOffset && <div className="invisible h-8 w-8" aria-hidden />}
          <div
            className={cn(
              "relative flex items-center justify-center gap-2",
              "rounded-md bg-ods-card border border-ods-border",
              "px-3 py-3",
              "transition-colors",
            )}
          >
            <ChatTypingIndicator size="sm" dotClassName="bg-ods-text-primary" />
            <p className="text-h4 text-ods-text-secondary">
              Waiting for Technician Response
            </p>
          </div>
        </div>
      )
    }

    return (
      <div
        className={cn(
          "mx-auto w-full max-w-3xl items-end gap-6",
          reserveAvatarOffset ? "grid grid-cols-[32px_1fr]" : "grid grid-cols-[1fr]",
          "flex-shrink-0",
          className
        )}
      >
        {reserveAvatarOffset && <div className="invisible h-8 w-8" aria-hidden />}
        <div className="relative">
          {slashSuggestions.length > 0 && slashPrefix !== null && (
            <Card
              role="listbox"
              aria-label="Slash command suggestions"
              className={cn(
                "absolute bottom-full mb-2 left-0 right-0 max-h-72 overflow-auto",
                "bg-ods-card text-ods-text-primary border-ods-border",
                "z-50 p-1",
              )}
            >
              {slashSuggestions.map((cmd, idx) => (
                <Button
                  key={cmd.id}
                  variant="transparent"
                  size="small"
                  fullWidth
                  type="button"
                  role="option"
                  aria-selected={idx === highlightedIdx}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => acceptSuggestion(cmd)}
                  className={cn(
                    "justify-start text-left h-auto py-2 px-3",
                    "text-ods-text-primary",
                    idx === highlightedIdx
                      ? "bg-ods-card-hover"
                      : "bg-transparent",
                  )}
                >
                  <span className="font-mono text-h5 mr-2 text-ods-text-primary">
                    /{cmd.id}
                  </span>
                  <span className="text-h5 text-ods-text-secondary truncate">
                    — {cmd.description}
                  </span>
                </Button>
              ))}
            </Card>
          )}
          <div
            className={cn(
              "flex items-center gap-2",
              "rounded-md bg-ods-card border border-ods-border",
              "transition-colors",
              "text-left text-ods-text-primary",
            )}
          >
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Connection lost. Waiting to reconnect..." : placeholder}
              disabled={sending || disabled}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent px-3 border-none focus-visible:ring-0",
                "font-dm-sans text-[18px] font-medium leading-[24px]",
                "placeholder:text-ods-text-secondary",
                "overflow-hidden text-ellipsis",
                "min-h-[20px] max-h-[160px] focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              {...props}
            />

            {sending && onStop ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={isStopping}
                className={cn(
                  "rounded-md px-3 text-ods-text-secondary transition-all",
                  isStopping ? "cursor-not-allowed opacity-40" : "hover:text-ods-accent active:scale-95",
                  "focus:outline-none"
                )}
                aria-label="Stop generation"
              >
                <StopIcon size={24} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending || disabled || !value.trim()}
                className={cn(
                  "rounded-md px-3 text-ods-text-secondary transition-all",
                  sending || disabled || !value.trim() ? "cursor-not-allowed opacity-40" : "hover:text-ods-text-primary active:scale-95",
                  "focus:outline-none"
                )}
                aria-label="Send message"
              >
                <Send01Icon size={24} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
)

ChatInput.displayName = "ChatInput"

export { ChatInput }
