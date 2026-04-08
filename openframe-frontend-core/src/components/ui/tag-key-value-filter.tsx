"use client"

import { useMemo } from "react"

import { cn } from "../../utils/cn"
import { FilterCheckboxItem } from "./filter-checkbox-item"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagValueOption {
  id: string
  label: string
  count?: number
}

export interface TagKeyConfig {
  /** Unique key identifier, used as prefix in tags (e.g. "site" → "site:chicago") */
  key: string
  /** Display label for the key */
  label: string
  /** Available values for this key */
  values: TagValueOption[]
}

export interface TagKeyValueFilterProps {
  /** Available tag keys with their values */
  keys: TagKeyConfig[]
  /** Currently selected tags in "key:value" format */
  selectedTags: string[]
  /** Called when tags change */
  onTagsChange: (tags: string[]) => void
  /** Title for the keys block. Default "Tag Keys" */
  keysTitle?: string
  /** Custom className */
  className?: string
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TagKeyValueFilter({
  keys,
  selectedTags,
  onTagsChange,
  keysTitle = "Tag Keys",
  className,
}: TagKeyValueFilterProps) {
  // Parse selected tags → { "site": Set(["chicago"]), "env": Set(["production"]) }
  const selectedMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const tag of selectedTags) {
      const colonIdx = tag.indexOf(":")
      if (colonIdx === -1) continue
      const key = tag.slice(0, colonIdx)
      const value = tag.slice(colonIdx + 1)
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(value)
    }
    return map
  }, [selectedTags])

  // Which keys are "active" (checked in the keys list)
  const activeKeys = useMemo(() => {
    return new Set(selectedMap.keys())
  }, [selectedMap])

  // Toggle a key on/off — when unchecked, remove ALL values for that key
  const handleKeyToggle = (key: string, checked: boolean) => {
    if (checked) {
      // Add a marker so the section appears even with no values checked
      onTagsChange([...selectedTags, `${key}:`])
    } else {
      // Remove all tags that start with this key
      onTagsChange(selectedTags.filter((t) => !t.startsWith(`${key}:`)))
    }
  }

  // Toggle a specific value
  const handleValueToggle = (key: string, valueId: string, checked: boolean) => {
    const tag = `${key}:${valueId}`
    if (checked) {
      // Remove the empty marker if it exists, add the real value
      const cleaned = selectedTags.filter((t) => t !== `${key}:`)
      onTagsChange([...cleaned, tag])
    } else {
      const newTags = selectedTags.filter((t) => t !== tag)
      // If no values left for this key, keep the empty marker so section stays visible
      const hasOtherValues = newTags.some((t) => t.startsWith(`${key}:`) && t !== `${key}:`)
      if (!hasOtherValues) {
        onTagsChange([...newTags, `${key}:`])
      } else {
        onTagsChange(newTags)
      }
    }
  }

  // Keys that are checked → their value sections appear below
  const activeKeyConfigs = keys.filter((k) => activeKeys.has(k.key))

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Tag Keys checkbox list ── */}
      <div className="flex flex-col gap-2">
        <span className="text-h5 text-ods-text-secondary tracking-[-0.28px] uppercase">
          {keysTitle}
        </span>
        <div className="rounded-[6px] border border-ods-border overflow-hidden">
          {keys.map((keyConfig) => (
            <FilterCheckboxItem
              key={keyConfig.key}
              label={keyConfig.label}
              checked={activeKeys.has(keyConfig.key)}
              onChange={(checked) => handleKeyToggle(keyConfig.key, checked)}
            />
          ))}
        </div>
      </div>

      {/* ── Value sections for each checked key ── */}
      {activeKeyConfigs.map((keyConfig) => {
        const selectedValues = selectedMap.get(keyConfig.key) ?? new Set()
        return (
          <div key={keyConfig.key} className="flex flex-col gap-2">
            <span className="text-h5 text-ods-text-secondary tracking-[-0.28px] uppercase">
              {keyConfig.label}
            </span>
            <div className="rounded-[6px] border border-ods-border overflow-hidden">
              {keyConfig.values.map((option) => (
                <FilterCheckboxItem
                  key={option.id}
                  label={option.label}
                  count={option.count}
                  checked={selectedValues.has(option.id)}
                  onChange={(checked) =>
                    handleValueToggle(keyConfig.key, option.id, checked)
                  }
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
