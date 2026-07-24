"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { ImagePlusIcon } from "../icons-v2-generated/audio-and-visual/image-plus-icon"
import { Refresh02VrIcon } from "../icons-v2-generated/media-playback/refresh-02-vr-icon"
import { TrashIcon } from "../icons-v2-generated/interface/trash-icon"
import { useAuthedImageSrc } from "../../hooks/use-authed-image-src"
import { cn } from "../../utils/cn"
import { FieldWrapper } from "./field-wrapper"

export interface ImageUploaderProps {
  /** Current image URL (remote, blob, or data URL). When set, the preview state is shown. */
  value?: string
  /** Fired when the user picks or drops a new image. The consumer is responsible for uploading. */
  onChange: (file: File) => void
  /** Fired when the user clicks the trash icon. Omit to hide the remove button. */
  onRemove?: () => void
  /** Accepted MIME types or extensions. Default: "image/*" */
  accept?: string
  /** Maximum file size in bytes. Default: 25MB */
  maxSize?: number
  /** Empty-state primary label. */
  label?: string
  /** Empty-state secondary description. */
  description?: string
  /** Empty-state hint line. Pass `null` to hide it. Default: derived from `maxSize`. */
  hint?: React.ReactNode | null
  /** Field label rendered above the component (via FieldWrapper). */
  fieldLabel?: string
  /** Disables interaction. */
  disabled?: boolean
  /** Show loading state — disables interaction and renders a spinner overlay. */
  loading?: boolean
  /** External error message. Internal validation errors take precedence when present. */
  error?: string
  /** CSS aspect-ratio for the dropzone, e.g. "16 / 9", "1 / 1". When set, overrides the default fixed height. */
  aspectRatio?: string
  /** object-fit for the preview image. Default: "cover" */
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down"
  /** Alt text for the preview image. */
  alt?: string
  /** Extra className on the FieldWrapper root. */
  className?: string
  /**
   * Extra className on the dropzone element itself. Merged after the defaults, so it can
   * override the built-in sizing (e.g. pass `h-[148px]` to replace the default `h-44`).
   */
  dropzoneClassName?: string
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`
  const kb = bytes / 1024
  return Number.isInteger(kb) ? `${kb}KB` : `${kb.toFixed(0)}KB`
}

function matchesAccept(file: File, accept: string): boolean {
  if (!accept || accept === "*/*") return true
  const patterns = accept
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  if (patterns.length === 0) return true
  const fileType = (file.type || "").toLowerCase()
  const fileName = file.name.toLowerCase()
  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) return fileName.endsWith(pattern)
    if (pattern.endsWith("/*")) return fileType.startsWith(pattern.slice(0, -1))
    return fileType === pattern
  })
}

export function ImageUploader({
  value,
  onChange,
  onRemove,
  accept = "image/*",
  maxSize = DEFAULT_MAX_SIZE,
  label = "Cover Image",
  description = "(Click Here or Drag and Drop)",
  hint,
  fieldLabel,
  disabled = false,
  loading = false,
  error,
  aspectRatio,
  objectFit = "cover",
  alt = "Uploaded image",
  className,
  dropzoneClassName,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const interactive = !disabled && !loading
  // Bearer-mode shells: swap a gateway URL for an authed blob URL (native
  // <img> loads can't carry Authorization); pass-through everywhere else,
  // including local blob/data preview URLs. `hasImage` stays keyed on the
  // caller's `value` so the preview chrome doesn't flash to the empty
  // state while the blob fetch is in flight.
  const resolvedValue = useAuthedImageSrc(value)
  const hasImage = Boolean(value)
  const displayError = error || validationError || undefined
  const resolvedHint = hint === undefined ? `Max. size: ${formatSize(maxSize)}` : hint

  const validateAndEmit = (file?: File) => {
    if (!file) return
    setValidationError(null)
    if (!matchesAccept(file, accept)) {
      setValidationError("Unsupported file type")
      return
    }
    if (file.size > maxSize) {
      setValidationError(`File exceeds maximum size of ${formatSize(maxSize)}`)
      return
    }
    onChange(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndEmit(e.target.files?.[0])
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!interactive) return
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (!interactive) return
    validateAndEmit(e.dataTransfer.files?.[0])
  }

  const openDialog = () => {
    if (!interactive) return
    inputRef.current?.click()
  }

  const handleRootKeyDown = (e: React.KeyboardEvent) => {
    if (hasImage || !interactive) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      openDialog()
    }
  }

  const isActionState = dragActive || (pressed && !hasImage)

  return (
    <FieldWrapper label={fieldLabel} error={displayError} className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={!interactive}
      />

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!hasImage ? openDialog : undefined}
        onKeyDown={handleRootKeyDown}
        onMouseDown={!hasImage ? () => setPressed(true) : undefined}
        onMouseUp={!hasImage ? () => setPressed(false) : undefined}
        onMouseLeave={!hasImage ? () => setPressed(false) : undefined}
        role={!hasImage ? "button" : undefined}
        tabIndex={!hasImage && interactive ? 0 : undefined}
        aria-disabled={!interactive || undefined}
        style={aspectRatio ? { aspectRatio } : undefined}
        className={cn(
          "relative flex w-full flex-col items-center justify-center gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)] rounded-md",
          !aspectRatio && "h-44",
          "border border-dashed transition-colors duration-150",
          hasImage
            ? "bg-ods-bg border-ods-border"
            : isActionState
              ? "bg-ods-bg-active border-ods-border-active"
              : "bg-ods-card border-ods-border",
          !hasImage && interactive && !isActionState && "cursor-pointer hover:bg-ods-bg-hover hover:border-ods-border-hover",
          !interactive && "opacity-60",
          !hasImage && !interactive && "cursor-not-allowed",
          dropzoneClassName,
        )}
      >

        {hasImage ? (
          <>
            <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-md">
              {resolvedValue && (
                <img
                  src={resolvedValue}
                  alt={alt}
                  className={cn(
                    "pointer-events-none absolute inset-0 size-full",
                    objectFit === "cover" && "object-cover",
                    objectFit === "contain" && "object-contain",
                    objectFit === "fill" && "object-fill",
                    objectFit === "none" && "object-none",
                    objectFit === "scale-down" && "object-scale-down",
                  )}
                />
              )}
            </div>

            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
              <ActionIconButton
                onClick={openDialog}
                disabled={!interactive}
                ariaLabel="Replace image"
              >
                <Refresh02VrIcon className="size-6" />
              </ActionIconButton>
              {onRemove && (
                <ActionIconButton
                  onClick={onRemove}
                  disabled={!interactive}
                  ariaLabel="Remove image"
                >
                  <TrashIcon className="size-6" />
                </ActionIconButton>
              )}
            </div>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-ods-overlay">
                <Loader2 className="size-8 animate-spin text-ods-text-on-dark" />
              </div>
            )}
          </>
        ) : loading ? (
          <Loader2 className="size-8 animate-spin text-ods-accent" />
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-card p-[var(--spacing-system-s)]">
              <ImagePlusIcon className="size-6 text-ods-text-primary" />
            </div>
            <div className="flex w-full flex-col items-center text-center">
              <p className="text-h4 text-ods-text-primary">{label}</p>
              <p className="text-h6 text-ods-text-secondary">{description}</p>
              {resolvedHint && (
                <p className="text-h6 text-ods-text-secondary">{resolvedHint}</p>
              )}
            </div>
          </>
        )}
      </div>
    </FieldWrapper>
  )
}

interface ActionIconButtonProps {
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
  children: React.ReactNode
}

function ActionIconButton({ onClick, disabled, ariaLabel, children }: ActionIconButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md p-3",
        "bg-[var(--ods-system-greys-white)] text-ods-text-on-accent",
        "transition-colors duration-150",
        "hover:bg-[var(--ods-system-greys-white-hover)]",
        "active:bg-[var(--ods-system-greys-white-action)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ods-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {children}
    </button>
  )
}

