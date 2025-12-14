"use client"

import * as React from "react"
import { X, Plus } from "lucide-react"
import { Input } from "./input"
import { Button } from "./button"
import { Badge } from "./badge"
import { cn } from "../../utils/cn"

interface TagsInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxTags?: number
  inputClassName?: string
  badgeClassName?: string
  label?: string
}

export function TagsInput({
  value = [],
  onChange,
  placeholder = "Add a tag...",
  className,
  disabled = false,
  maxTags,
  inputClassName,
  badgeClassName,
  label
}: TagsInputProps) {
  const [inputValue, setInputValue] = React.useState("")

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim()
    
    if (!trimmedValue) return
    
    // Check if tag already exists
    if (value.includes(trimmedValue)) {
      setInputValue("")
      return
    }
    
    // Check max tags limit
    if (maxTags && value.length >= maxTags) {
      return
    }
    
    onChange([...value, trimmedValue])
    setInputValue("")
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="font-['DM_Sans'] text-[16px] font-medium text-ods-text-primary">
          {label}
        </label>
      )}
      
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || (maxTags ? value.length >= maxTags : false)}
          className={cn(
            "flex-1 bg-[#161616] border-ods-border text-ods-text-primary",
            inputClassName
          )}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddTag}
          disabled={disabled || !inputValue.trim() || (maxTags ? value.length >= maxTags : false)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add
        </Button>
      </div>
      
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              className={cn(
                "pl-2 pr-1 py-1 flex items-center gap-1",
                badgeClassName
              )}
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:bg-white/20 rounded p-0.5 transition-colors"
                  aria-label={`Remove ${tag} tag`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      
      {maxTags && (
        <p className="text-xs text-ods-text-secondary">
          {value.length}/{maxTags} tags
        </p>
      )}
    </div>
  )
}