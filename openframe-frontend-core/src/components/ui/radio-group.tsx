"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "../../utils/cn"

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "group relative h-6 w-6 shrink-0 rounded-full border-2 bg-ods-card",
        "border-[var(--color-border-strong)]",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-ods-accent",
        "hover:enabled:border-ods-accent/60",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
        <span className="block h-1/2 w-1/2 rounded-full bg-ods-accent" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

interface RadioGroupBlockOption {
  value: string
  label: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  /** Optional trailing slot rendered at the end of the row (e.g. a discount tag) */
  trailing?: React.ReactNode
}

interface RadioGroupBlockProps
  extends Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, "children"> {
  options: RadioGroupBlockOption[]
  /**
   * - `separated` (default): each option is its own bordered card stacked with gaps.
   * - `grouped`: options share a single outer border with dividers between rows.
   */
  variant?: "separated" | "grouped"
  /** Error message displayed below the group (also triggers red borders) */
  error?: string
  itemClassName?: string
}

const RadioGroupBlock = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupBlockProps
>(
  (
    { className, options, variant = "separated", error, itemClassName, disabled, ...props },
    ref
  ) => {
    const isGrouped = variant === "grouped"
    return (
      <div className={cn("relative flex w-full flex-col", className)}>
        <RadioGroupPrimitive.Root
          ref={ref}
          className={cn(
            "w-full",
            isGrouped
              ? cn(
                  "flex flex-col overflow-hidden rounded-[6px] border bg-ods-card",
                  error ? "border-ods-error" : "border-ods-border"
                )
              : "grid gap-2"
          )}
          disabled={disabled}
          {...props}
        >
          {options.map((option, index) => {
            const itemId = `${props.name ?? "radio-block"}-${option.value}`
            const isDisabled = disabled || option.disabled
            const isLast = index === options.length - 1
            return (
              <label
                key={option.value}
                htmlFor={itemId}
                aria-disabled={isDisabled || undefined}
                className={cn(
                  "flex w-full items-center gap-3",
                  "transition-colors duration-200",
                  isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                  isGrouped
                    ? cn(
                        "bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs,8px)]",
                        !isLast && "border-b",
                        error ? "border-ods-error" : "border-ods-border"
                      )
                    : cn(
                        "rounded-[6px] border bg-ods-card p-[var(--spacing-system-sf)]",
                        !isDisabled && "hover:border-ods-accent/30",
                        !isDisabled &&
                          "has-[[data-state=checked]]:bg-[var(--ods-system-greys-soft-grey)]/30 has-[[data-state=checked]]:border-ods-accent/40",
                        error ? "border-ods-error" : "border-ods-border"
                      ),
                  isDisabled && "opacity-50",
                  itemClassName
                )}
              >
                <RadioGroupPrimitive.Item
                  id={itemId}
                  value={option.value}
                  disabled={isDisabled}
                  className={cn(
                    "h-6 w-6 shrink-0 rounded-full border-2 bg-ods-card",
                    error ? "border-ods-error" : "border-[var(--color-border-strong)]",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card",
                    "disabled:cursor-not-allowed",
                    "data-[state=checked]:border-ods-accent"
                  )}
                >
                  <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
                    <span className="block h-1/2 w-1/2 rounded-full bg-ods-accent" />
                  </RadioGroupPrimitive.Indicator>
                </RadioGroupPrimitive.Item>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <span
                    className={cn(
                      "font-[family-name:var(--font-h4-family)] font-[number:var(--font-h4-weight)] text-[length:var(--font-size-h4-body)] leading-[24px]",
                      "text-ods-text-primary select-none truncate"
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span
                      className={cn(
                        "font-[family-name:var(--font-h6-family)] font-[number:var(--font-h6-weight)] text-[length:var(--font-size-h6-caption)] leading-[20px]",
                        "text-ods-text-secondary select-none"
                      )}
                    >
                      {option.description}
                    </span>
                  )}
                </div>
                {option.trailing && (
                  <div className="ml-auto flex shrink-0 items-center">{option.trailing}</div>
                )}
              </label>
            )
          })}
        </RadioGroupPrimitive.Root>
        {error && (
          <p className="absolute bottom-0 left-0 right-0 translate-y-full text-h6 truncate text-ods-error">
            {error}
          </p>
        )}
      </div>
    )
  }
)
RadioGroupBlock.displayName = "RadioGroupBlock"

export { RadioGroup, RadioGroupItem, RadioGroupBlock }
export type { RadioGroupBlockProps, RadioGroupBlockOption }
