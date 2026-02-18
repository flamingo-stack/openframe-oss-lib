"use client"

import * as React from "react"
import { X, XCircle, CheckCircle2 } from "lucide-react"
import { Modal } from "./modal"
import { Input } from "./input"
import { Button } from "./button"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip"
import { cn } from "../../utils/cn"

export interface CategoryItem {
  id: string
  name: string
}

export interface CategoryManagementModalProps {
  isOpen: boolean
  onClose: () => void
  label: string
  items: CategoryItem[]
  onCreate: (name: string) => void | Promise<void>
  onDelete: (item: CategoryItem) => void | Promise<void>
  onApply: () => void | Promise<void>
  inputPlaceholder?: string
  inputLabel?: string
  applyButtonText?: string
  cancelButtonText?: string
  isSubmitting?: boolean
  className?: string
  maxItems?: number
}

function CategoryChip({
  item,
  onDelete,
  isSubmitting,
}: {
  item: CategoryItem
  onDelete: (item: CategoryItem) => void | Promise<void>
  isSubmitting: boolean
}) {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useEffect(() => {
    const el = textRef.current
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth)
  }, [item.name])

  const chip = (
    <div className="flex items-center gap-1.5 bg-ods-card border border-ods-border rounded-[6px] h-[32px] px-2.5 max-w-[240px]">
      <span
        ref={textRef}
        className="font-['Azeret_Mono'] text-[14px] font-medium uppercase text-ods-text-primary truncate"
      >
        {item.name}
      </span>
      <button
        type="button"
        onClick={() => onDelete(item)}
        className="text-ods-text-secondary hover:text-ods-text-primary transition-colors flex-shrink-0"
        aria-label={`Remove ${item.name}`}
        disabled={isSubmitting}
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  )

  if (!isTruncated) return chip

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{item.name}</TooltipContent>
    </Tooltip>
  )
}

export function CategoryManagementModal({
  isOpen,
  onClose,
  label,
  items,
  onCreate,
  onDelete,
  onApply,
  inputPlaceholder = "Enter Tag Name",
  inputLabel = "Add New Category",
  applyButtonText = "Apply",
  cancelButtonText = "Cancel",
  isSubmitting = false,
  className,
  maxItems,
}: CategoryManagementModalProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [filterValue, setFilterValue] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset input and filter when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setInputValue("")
      setFilterValue("")
    }
  }, [isOpen])

  const filteredItems = React.useMemo(() => {
    if (!filterValue.trim()) return items
    const lower = filterValue.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(lower))
  }, [items, filterValue])

  const handleAdd = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    // Duplicate detection (case-insensitive)
    if (items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      setInputValue("")
      return
    }

    // Max items check
    if (maxItems && items.length >= maxItems) return

    await onCreate(trimmed)
    setInputValue("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  const canAdd = inputValue.trim().length > 0 && !(maxItems && items.length >= maxItems)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={cn("max-w-[600px] !p-0", className)}
    >
      <TooltipProvider>
        <div className="p-10 flex flex-col gap-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-['Azeret_Mono'] text-[32px] font-semibold leading-tight text-ods-text-primary">
              {label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-ods-text-secondary hover:text-ods-text-primary transition-colors"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tags area */}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* Search filter — only for large sets */}
              {items.length > 10 && (
                <div className="flex items-center gap-2">
                  <Input
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Filter..."
                    className="flex-1 bg-[#161616] border-ods-border h-8 text-sm"
                  />
                  <span className="text-xs text-ods-text-secondary whitespace-nowrap">
                    {filterValue
                      ? `${filteredItems.length} of ${items.length}`
                      : `${items.length} total`}
                  </span>
                </div>
              )}

              <ScrollAreaPrimitive.Root className="relative overflow-hidden">
                <ScrollAreaPrimitive.Viewport className="max-h-[40vh] w-full">
                  <div className="flex flex-wrap gap-2 pr-2">
                    {filteredItems.map((item) => (
                      <CategoryChip
                        key={item.id}
                        item={item}
                        onDelete={onDelete}
                        isSubmitting={isSubmitting}
                      />
                    ))}
                  </div>
                </ScrollAreaPrimitive.Viewport>
                <ScrollAreaPrimitive.Scrollbar
                  className="flex touch-none select-none p-0.5 bg-transparent transition-colors duration-150 ease-out data-[orientation=vertical]:w-2.5"
                  orientation="vertical"
                >
                  <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[#3a3a3a]" />
                </ScrollAreaPrimitive.Scrollbar>
              </ScrollAreaPrimitive.Root>
            </div>
          )}

          {/* Add input row */}
          <div className="flex flex-col gap-2">
            <label className="font-['DM_Sans'] text-[16px] font-medium text-ods-text-primary">
              {inputLabel}
            </label>
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={isSubmitting || (maxItems ? items.length >= maxItems : false)}
                className="flex-1 bg-[#161616] border-ods-border"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd || isSubmitting}
                className={cn(
                  "transition-colors",
                  canAdd && !isSubmitting
                    ? "text-ods-accent hover:text-ods-accent-hover"
                    : "text-ods-text-secondary cursor-not-allowed"
                )}
                aria-label="Add"
              >
                <CheckCircle2 className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              {cancelButtonText}
            </Button>
            <Button
              variant="primary"
              onClick={onApply}
              disabled={isSubmitting}
              loading={isSubmitting}
              className="flex-1"
            >
              {applyButtonText}
            </Button>
          </div>
        </div>
      </TooltipProvider>
    </Modal>
  )
}
