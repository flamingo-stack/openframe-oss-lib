"use client"

import * as React from "react"
import { PlusCircle, X } from "lucide-react"
import { cn } from "../../utils/cn"
import { Input } from "./input"
import { Button } from "./button"
import { Label } from "./label"

interface AllowedDomainsInputProps {
  value: string[]
  onChange: (domains: string[]) => void
  onValidate?: (domain: string) => { valid: boolean; error?: string; cleanedDomain?: string }
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: string | null
  helperText?: string
  className?: string
}

const AllowedDomainsInput = React.forwardRef<HTMLDivElement, AllowedDomainsInputProps>(
  (
    {
      value,
      onChange,
      onValidate,
      label = "Allowed Domains",
      placeholder = "example.com",
      disabled = false,
      error,
      helperText,
      className
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState("")
    const [localError, setLocalError] = React.useState<string | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const displayError = error || localError

    const addDomain = () => {
      const trimmedValue = inputValue.trim()
      if (!trimmedValue) return

      // Validate if validator provided
      if (onValidate) {
        const validation = onValidate(trimmedValue)
        if (!validation.valid) {
          setLocalError(validation.error || "Invalid domain")
          return
        }
        // Use cleaned domain if provided
        const domainToAdd = validation.cleanedDomain || trimmedValue
        if (!value.includes(domainToAdd)) {
          onChange([...value, domainToAdd])
          setLocalError(null)
        }
      } else {
        // No validation, just add if not duplicate
        if (!value.includes(trimmedValue)) {
          onChange([...value, trimmedValue])
        }
      }
      setInputValue("")
    }

    const removeDomain = (index: number) => {
      const newDomains = value.filter((_, i) => i !== index)
      onChange(newDomains)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        addDomain()
      }
    }

    return (
      <div ref={ref} className={cn("space-y-3", className)}>
        {label && <Label>{label}</Label>}

        {/* Existing domains */}
        {value.map((domain, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={domain}
              disabled
              className="bg-[#212121] border-[#3a3a3a] rounded-[6px] flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              centerIcon={<X className="h-4 w-4" />}
              onClick={() => removeDomain(index)}
              disabled={disabled}
              className="text-ods-text-secondary hover:text-ods-text-primary shrink-0"
            />
          </div>
        ))}

        {/* Add new domain input */}
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setLocalError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="bg-[#212121] border-[#3a3a3a] rounded-[6px] flex-1"
          />
        </div>

        {/* Add Domain button */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 py-2 text-ods-text-primary hover:text-ods-accent transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={addDomain}
          disabled={disabled}
        >
          <PlusCircle className="h-5 w-5 text-[#888888]" />
          <span className="font-['DM_Sans'] font-bold text-base">Add Domain</span>
        </button>

        {/* Error message */}
        {displayError && (
          <p className="text-sm text-error">{displayError}</p>
        )}

        {/* Helper text */}
        {helperText && !displayError && (
          <p className="text-sm text-ods-text-secondary">{helperText}</p>
        )}
      </div>
    )
  }
)

AllowedDomainsInput.displayName = "AllowedDomainsInput"

export { AllowedDomainsInput }
export type { AllowedDomainsInputProps }
