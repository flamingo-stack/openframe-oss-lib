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
  /** Element rendered at the LEFT edge of the field (e.g. a `+` add button).
   *  Like `endIcon`, presence of this lifts the field into the wrapped layout
   *  so the adornment sits visually inside the same border. Pass an
   *  already-interactive node (button / menu trigger) — it renders verbatim. */
  startIcon?: React.ReactNode;
  /** When true (adorned layout only), the field draws NO border / background /
   *  radius of its own — only its inner padding & layout. Use when an outer
   *  container provides the card chrome (e.g. composer with a context-chip
   *  header above the input, Figma 1:6073). */
  hideBorder?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, label, error, endIcon, endIconAsButton = false, endIconButtonProps, startIcon, hideBorder = false, ...props }, ref) => {
    const isInvalid = invalid || !!error
    const hasAdornment = !!endIcon || !!startIcon

    // The adorned layout wraps the field in a `<label>`. Without an explicit
    // `htmlFor`, the label's control defaults to its FIRST labelable descendant
    // — which is `startIcon` (e.g. the composer `+` button) when present, so a
    // click anywhere on the field synthesises a click on that button. Bind the
    // label to the textarea explicitly to keep clicks (and focus) on the input.
    const reactId = React.useId()
    const fieldId = props.id ?? reactId

    // Without any adornment we keep the historical layout: bare textarea, the
    // border/bg/hover all live on the textarea itself.
    if (!hasAdornment) {
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
    //
    // Focus selector: historically `has-[:focus]` (any focusable descendant —
    // textarea OR the end-icon submit button — lights the accent). We narrow it
    // to `textarea:focus` ONLY when a `startIcon` is present, because that's the
    // composer-context layout where the start adornment hosts the context
    // picker's own `<input>` (search field) — which must NOT light the field
    // chrome. End-icon-only consumers (ticket reply, contact form, …) keep the
    // original any-focus behaviour so the submit-button focus ring is unchanged.
    const accentBorder = startIcon
      ? "has-[textarea:focus]:border-ods-accent"
      : "has-[:focus]:border-ods-accent"
    const accentBorderError = startIcon
      ? "has-[textarea:focus]:border-ods-error"
      : "has-[:focus]:border-ods-error"
    const adornmentAccent = startIcon
      ? "group-has-[textarea:focus]:text-ods-accent"
      : "group-has-[:focus]:text-ods-accent"
    const content = (
      <label
        htmlFor={fieldId}
        data-invalid={isInvalid || undefined}
        className={cn(
          // Wrapper mirrors `Input`, but uses `items-end` so the icon sticks
          // to the bottom-right when the textarea grows multi-line. Vertical
          // padding lives here (not on the textarea) so both children share
          // the same bottom baseline at any height.
          //
          // Padding is sized so the single-line height matches `Input` exactly
          // (44px mobile / 48px desktop): line `leading-6` (24px) + 2× padding
          // + 1px border top/bottom. `min-h-11 md:min-h-12` is the matching
          // floor; with symmetric padding the single line stays centered.
          "flex w-full items-end gap-2 px-3 py-[9px] md:py-[11px] min-h-11 md:min-h-12 cursor-text",
          "has-[:focus-visible]:outline-none",
          "group",
          "transition-colors duration-200",
          // Card chrome (border / bg / radius / hover / focus). Suppressed when
          // `hideBorder` — an outer container owns it instead.
          !hideBorder && cn("rounded-[6px] border bg-ods-card border-ods-border", accentBorder),
          !hideBorder && !props.disabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
          !hideBorder && props.disabled && "!cursor-not-allowed bg-ods-bg",
          !hideBorder && isInvalid && cn("border-ods-error hover:border-ods-error", accentBorderError),
          hideBorder && "bg-transparent",
        )}
      >
        {startIcon && (
          // Start adornment (e.g. the composer `+`). `items-end` + `h-6`
          // co-centers it with the first text line, matching `endIcon`. The
          // node is rendered verbatim so callers can pass an interactive
          // button / menu trigger and own its styling + active color.
          <span className="flex h-6 shrink-0 items-center">{startIcon}</span>
        )}
        <textarea
          ref={ref}
          rows={1}
          id={fieldId}
          className={cn(
            "flex-1 min-w-0 resize-none bg-transparent border-none outline-none p-0 m-0 box-border",
            // Native CSS auto-grow (Chrome 123+, FF 124+, Safari 16.4+) — no
            // JS needed to size to content. Falls back to `rows={1}` natural
            // height on older browsers.
            "[field-sizing:content]",
            // `!leading-6` (not plain `leading-6`): on mobile `text-h4` sets a
            // 20px line-height of its own that otherwise overrides the leading,
            // leaving the 20px text box short of the 24px icon box and dropping
            // the text below center under `items-end`. Forcing 24px keeps text
            // and icon co-centered and the single-line height at 44px.
            "text-h4 text-ods-text-primary placeholder:text-ods-text-secondary !leading-6",
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
              // `h-6` matches the textarea's `leading-6` line box so the icon's
              // visual center lines up with the text on the first line. Without
              // it, `items-end` bottom-aligns the smaller mobile icon (size-4)
              // against the 24px text line and drops it below the text center.
              "flex h-6 shrink-0 items-center text-ods-text-secondary transition-colors duration-200",
              adornmentAccent,
              "group-data-[invalid]:text-ods-error",
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
              "flex h-6 shrink-0 items-center text-ods-text-secondary transition-colors duration-200",
              adornmentAccent,
              "group-data-[invalid]:text-ods-error",
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
