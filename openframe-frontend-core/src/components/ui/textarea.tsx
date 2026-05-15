"use client"

import * as React from "react"

import { cn } from "../../utils/cn"
import { FieldWrapper } from "./field-wrapper"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, renders red error border & ring */
  invalid?: boolean;
  /** Label text displayed above the textarea */
  label?: string;
  /** Error message displayed below the textarea */
  error?: string;
  /** Element rendered at the right edge of the field (e.g. send icon). */
  endIcon?: React.ReactNode;
  /**
   * When true, `endIcon` is wrapped in a real `<button>` with hover / active
   * / focus-visible styling matching the rest of the design system. Pass any
   * extra button attributes (`onClick`, `disabled`, `aria-label`, …) via
   * `endIconButtonProps`.
   */
  endIconAsButton?: boolean;
  /** Extra attributes for the end-icon button. */
  endIconButtonProps?: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, label, error, endIcon, endIconAsButton = false, endIconButtonProps, ...props }, ref) => {
    const isInvalid = invalid || !!error
    const hasEndIcon = !!endIcon

    // Without an end icon we keep the historical layout: bare textarea, the
    // border/bg/hover all live on the textarea itself.
    if (!hasEndIcon) {
      return (
        <FieldWrapper label={label} error={error}>
          <textarea
            className={cn(
              "flex min-h-[96px] w-full rounded-[6px] border p-3",
              "text-h4",
              "focus-visible:outline-none focus:border-ods-accent",
              "transition-colors duration-200 touch-manipulation",
              "bg-ods-card border-ods-border text-ods-text-primary placeholder:text-ods-text-secondary",
              !props.disabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
              props.disabled && "!cursor-not-allowed bg-ods-bg disabled:placeholder:text-ods-border",
              "cursor-text relative z-10",
              "resize-y",
              isInvalid && "border-ods-error hover:border-ods-error focus:border-ods-error",
              className,
            )}
            ref={ref}
            {...props}
          />
        </FieldWrapper>
      )
    }

    // With an end icon we lift border/bg onto a `<label>` wrapper so the icon
    // sits visually inside the same field. The textarea becomes a transparent
    // child. Wrapper classes mirror `Input` 1:1 (same items-center, same
    // `has-[:focus]` selectors, same active state, same outline reset) so
    // hover / focus / cursor behaviour matches the standard input exactly.
    const content = (
      <label
        data-invalid={isInvalid || undefined}
        className={cn(
          // Wrapper mirrors `Input`, but uses `items-end` so the icon sticks
          // to the bottom-right when the textarea grows multi-line. Vertical
          // padding lives here (not on the textarea) so both children share
          // the same bottom baseline at any height.
          "flex w-full items-end gap-2 rounded-[6px] border px-3 py-2.5 md:py-3 min-h-11 md:min-h-12 cursor-text",
          "has-[:focus-visible]:outline-none",
          "group",
          "transition-colors duration-200",
          "bg-ods-card border-ods-border has-[:focus]:border-ods-accent",
          !props.disabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
          props.disabled && "!cursor-not-allowed bg-ods-bg",
          isInvalid && "border-ods-error hover:border-ods-error has-[:focus]:border-ods-error",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          className={cn(
            "flex-1 min-w-0 resize-none bg-transparent border-none outline-none p-0 m-0 box-border",
            // Native CSS auto-grow (Chrome 123+, FF 124+, Safari 16.4+) — no
            // JS needed to size to content. Falls back to `rows={1}` natural
            // height on older browsers.
            "[field-sizing:content]",
            "text-h4 text-ods-text-primary placeholder:text-ods-text-secondary leading-6",
            // Hard cap on growth: beyond `max-h` the textarea scrolls
            // internally instead of pushing the icon out of frame.
            "max-h-[160px] overflow-y-auto",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
            "disabled:cursor-not-allowed disabled:placeholder:text-ods-border",
            className,
          )}
          {...props}
        />

        {endIconAsButton ? (
          <button
            type="button"
            aria-label={endIconButtonProps?.['aria-label'] ?? 'Submit'}
            {...endIconButtonProps}
            className={cn(
              "flex shrink-0 items-center text-ods-text-secondary transition-colors duration-200",
              "group-has-[:focus]:text-ods-accent group-data-[invalid]:text-ods-error",
              "[&_svg]:size-4 md:[&_svg]:size-6",
              "cursor-pointer hover:text-ods-text-primary",
              "focus-visible:outline-none focus-visible:text-ods-accent",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ods-text-secondary",
              endIconButtonProps?.className,
            )}
          >
            {endIcon}
          </button>
        ) : (
          <span
            className={cn(
              "flex shrink-0 items-center text-ods-text-secondary transition-colors duration-200",
              "group-has-[:focus]:text-ods-accent group-data-[invalid]:text-ods-error",
              "[&_svg]:size-4 md:[&_svg]:size-6",
            )}
          >
            {endIcon}
          </span>
        )}
      </label>
    )

    return (
      <FieldWrapper label={label} error={error}>
        {content}
      </FieldWrapper>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
