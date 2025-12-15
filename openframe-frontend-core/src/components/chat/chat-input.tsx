"use client"

import { useState, useRef, useImperativeHandle, forwardRef, useCallback, type TextareaHTMLAttributes, type KeyboardEvent, type ChangeEvent } from "react"
import { cn } from "../../utils/cn"
import { Send } from "lucide-react"
import { Textarea } from "../ui/textarea"

export interface ChatInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  onSend?: (message: string) => void
  sending?: boolean
  reserveAvatarOffset?: boolean
  disabled?: boolean
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ className, onSend, sending = false, placeholder = "Enter your request here...", reserveAvatarOffset = true, disabled = false, ...props }, ref) => {
    const [value, setValue] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => textareaRef.current!)

    const handleSubmit = useCallback(() => {
      const message = value.trim()
      if (message && !sending && !disabled && onSend) {
        onSend(message)
        setValue('')

        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      }
    }, [value, sending, disabled, onSend])

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    }, [handleSubmit])

    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    }, [])
    
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
            "relative flex items-center gap-2",
            "rounded-lg bg-ods-bg-card border border-ods-border",
            "px-3 py-1.5",
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
              "flex-1 resize-none bg-transparent px-0 border-none focus-visible:ring-0",
              "font-dm-sans text-[18px] font-normal leading-[24px]",
              "placeholder:text-ods-text-secondary",
              "overflow-hidden text-ellipsis",
              "min-h-[20px] max-h-[160px] focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            {...props}
          />
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || disabled || !value.trim()}
            className={cn(
              "rounded-md p-1.5 text-ods-text-secondary transition-all",
              sending || disabled || !value.trim() ? "cursor-not-allowed opacity-40" : "hover:text-ods-text-primary active:scale-95",
              "focus:outline-none"
            )}
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    )
  }
)

ChatInput.displayName = "ChatInput"

export { ChatInput }