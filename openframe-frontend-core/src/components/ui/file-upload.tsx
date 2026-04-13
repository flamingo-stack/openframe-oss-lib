"use client"

import * as React from "react"
import { Loader2, X } from "lucide-react"
import { ImagePlusIcon } from "../icons-v2-generated/audio-and-visual/image-plus-icon"
import { cn } from "../../utils/cn"
import { FieldWrapper } from "./field-wrapper"

/** A managed file entry for async upload workflows (e.g. presigned URL uploads) */
export interface ManagedFileEntry {
  /** Unique identifier for this file (e.g. temp attachment ID from backend) */
  id: string
  /** Display file name */
  fileName: string
  /** File size in bytes */
  fileSize: number
  /** Upload status */
  status: "uploading" | "uploaded" | "error"
  /** Error message when status is "error" */
  error?: string
}

export interface FileUploadProps {
  /** Currently selected file(s) — use for simple, synchronous file handling */
  value?: File | File[]
  /** Callback when files change — used with `value` for simple mode */
  onChange: (files: File | File[] | undefined) => void
  /**
   * Managed file entries for async upload workflows.
   * When provided, the file list renders from these entries instead of `value`.
   * The dropzone still triggers `onChange` with new `File` objects so the consumer can upload them.
   */
  managedFiles?: ManagedFileEntry[]
  /** Callback to remove a managed file by its id. Required when `managedFiles` is provided. */
  onRemoveManagedFile?: (id: string) => void
  /** Accepted MIME types (e.g., "image/*", ".pdf,.doc") */
  accept?: string
  /** Maximum file size in bytes. Default: 10MB */
  maxSize?: number
  /** Maximum number of files (only used when multiple=true). Default: 10 */
  maxFiles?: number
  /** Allow multiple file selection. Default: false */
  multiple?: boolean
  /** Primary label text. Default: "Upload Files" */
  label?: string
  /** Description text below label. Default: "(Click Here or Drag and Drop)" */
  description?: string
  /** Field label above the component */
  fieldLabel?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Error message */
  error?: string
  /** Additional className */
  className?: string
  /** Custom icon element */
  icon?: React.ReactNode
  /** Max height for the file list area (e.g., 200 or "200px"). When set, the file list scrolls independently. */
  maxListHeight?: number | string
  /** Custom file picker function. When provided, this is called instead of the native HTML file input dialog. */
  onOpenFilePicker?: () => Promise<File | File[] | undefined>
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function FileUpload({
  value,
  onChange,
  managedFiles,
  onRemoveManagedFile,
  accept = "*/*",
  maxSize = 10 * 1024 * 1024,
  maxFiles = 10,
  multiple = false,
  label = "Upload Files",
  description = "(Click Here or Drag and Drop)",
  fieldLabel,
  disabled = false,
  error,
  className,
  icon,
  maxListHeight,
  onOpenFilePicker,
}: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isManaged = managedFiles !== undefined

  const files = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`
    }
    return null
  }

  const handleFiles = (newFiles: FileList | File[]) => {
    setValidationError(null)
    const fileArray = Array.from(newFiles)

    for (const file of fileArray) {
      const err = validateFile(file)
      if (err) {
        setValidationError(err)
        return
      }
    }

    if (isManaged) {
      // In managed mode, pass new files via onChange for the consumer to upload.
      // Don't accumulate — each batch is independent.
      onChange(multiple ? fileArray : fileArray[0])
    } else if (multiple) {
      const combined = [...files, ...fileArray]
      const limited = combined.slice(0, maxFiles)
      onChange(limited)
    } else {
      onChange(fileArray[0])
    }

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (disabled) return
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files)
    }
  }

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    if (updated.length === 0) {
      onChange(undefined)
    } else {
      onChange(multiple ? updated : updated[0])
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const openDialog = async () => {
    if (disabled) return

    if (onOpenFilePicker) {
      const result = await onOpenFilePicker()
      if (result) {
        const fileArray = Array.isArray(result) ? result : [result]
        if (fileArray.length > 0) {
          handleFiles(fileArray)
        }
      }
      return
    }

    fileInputRef.current?.click()
  }

  const displayError = error || validationError || undefined
  const hasFiles = isManaged ? managedFiles.length > 0 : files.length > 0
  const fileCount = isManaged ? managedFiles.length : files.length

  return (
    <FieldWrapper label={fieldLabel} error={displayError} className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Dropzone — always show when no files, or in managed mode (always allow adding) */}
      {!hasFiles && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openDialog}
          className={cn(
            "flex items-center gap-2 p-3 rounded-[6px] border border-dashed cursor-pointer",
            "transition-colors duration-200",
            "bg-ods-card border-ods-border",
            dragActive && "border-ods-accent bg-ods-accent/5",
            !dragActive && "hover:border-ods-accent/30",
            disabled && "opacity-50 cursor-not-allowed hover:border-ods-border",
          )}
        >
          <div className="flex items-center p-3 rounded-full bg-ods-card border border-ods-border shrink-0">
            {icon || <ImagePlusIcon className="size-6 text-ods-text-primary" />}
          </div>
          <div className="flex flex-1 flex-col font-['DM_Sans'] font-medium min-w-0">
            <span className="text-[18px] leading-6 text-ods-text-primary">{label}</span>
            <span className="text-[14px] leading-5 text-ods-text-secondary">{description}</span>
          </div>
        </div>
      )}

      {/* File list */}
      {hasFiles && (
        <div className="flex flex-col gap-2">
          <div
            className="flex flex-col gap-2"
            style={maxListHeight ? { maxHeight: typeof maxListHeight === "number" ? `${maxListHeight}px` : maxListHeight, overflowY: "auto" } : undefined}
          >
            {isManaged
              ? managedFiles.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-[6px] bg-ods-card border",
                      entry.status === "error" ? "border-[var(--ods-attention-red-error)]/40" : "border-ods-border",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-ods-text-primary truncate">
                        {entry.fileName}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-ods-text-secondary">
                          {formatFileSize(entry.fileSize)}
                        </span>
                        {entry.status === "uploading" && (
                          <span className="flex items-center gap-1 text-[12px] text-ods-text-secondary">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading...
                          </span>
                        )}
                        {entry.status === "error" && (
                          <span className="text-[12px] text-[var(--ods-attention-red-error)]">
                            {entry.error || "Upload failed"}
                          </span>
                        )}
                      </div>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveManagedFile?.(entry.id)}
                        className="shrink-0 p-1 rounded hover:bg-ods-bg transition-colors"
                        aria-label={`Remove ${entry.fileName}`}
                      >
                        <X className="size-4 text-ods-text-secondary" />
                      </button>
                    )}
                  </div>
                ))
              : files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 p-3 rounded-[6px] bg-ods-card border border-ods-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-ods-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-[12px] text-ods-text-secondary">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="shrink-0 p-1 rounded hover:bg-ods-bg transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-4 text-ods-text-secondary" />
                      </button>
                    )}
                  </div>
                ))
            }
          </div>

          {/* Add more button */}
          {multiple && fileCount < maxFiles && (
            <button
              type="button"
              onClick={openDialog}
              disabled={disabled}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-[6px]",
                "border border-dashed border-ods-border",
                "text-[14px] font-medium text-ods-text-secondary",
                "hover:border-ods-accent/30 hover:text-ods-text-primary",
                "transition-colors duration-200",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              Add more files
            </button>
          )}
        </div>
      )}
    </FieldWrapper>
  )
}
