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
  /**
   * When true, files dropped anywhere in the window are routed to this component,
   * and the browser's default file-open behavior is suppressed. Use on screens/modals
   * where this is the only drop target. Default: false.
   */
  acceptWindowDrops?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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

function dragHasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "Files") return true
  }
  return false
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
  acceptWindowDrops = false,
}: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isManaged = managedFiles !== undefined

  const files = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  const currentCount = isManaged ? managedFiles.length : files.length

  const validateFiles = (
    incoming: File[],
  ): { accepted: File[]; error: string | null } => {
    if (incoming.length === 0) return { accepted: [], error: null }

    const candidates = multiple ? incoming : incoming.slice(0, 1)

    for (const file of candidates) {
      if (!matchesAccept(file, accept)) {
        return { accepted: [], error: `File "${file.name}" is not an accepted type` }
      }
      if (file.size > maxSize) {
        return {
          accepted: [],
          error: `File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`,
        }
      }
    }

    if (multiple && currentCount + candidates.length > maxFiles) {
      return {
        accepted: [],
        error: `You can attach at most ${maxFiles} ${maxFiles === 1 ? "file" : "files"}`,
      }
    }

    return { accepted: candidates, error: null }
  }

  const handleFiles = (incoming: FileList | File[]) => {
    setValidationError(null)
    const fileArray = Array.from(incoming)
    if (fileArray.length === 0) return

    const { accepted, error: validationErr } = validateFiles(fileArray)
    if (validationErr) {
      setValidationError(validationErr)
      return
    }
    if (accepted.length === 0) return

    if (isManaged) {
      onChange(multiple ? accepted : accepted[0])
    } else if (multiple) {
      onChange([...files, ...accepted])
    } else {
      onChange(accepted[0])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFilesRef = React.useRef(handleFiles)
  handleFilesRef.current = handleFiles

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

  React.useEffect(() => {
    if (!acceptWindowDrops || disabled) return

    let dragCounter = 0

    const onWindowDragEnter = (e: DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      dragCounter++
      if (dragCounter === 1) setDragActive(true)
    }
    const onWindowDragOver = (e: DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
    }
    const onWindowDragLeave = (e: DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      dragCounter = Math.max(0, dragCounter - 1)
      if (dragCounter === 0) setDragActive(false)
    }
    const onWindowDrop = (e: DragEvent) => {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      dragCounter = 0
      setDragActive(false)
      if (e.dataTransfer?.files?.length) {
        handleFilesRef.current(e.dataTransfer.files)
      }
    }
    const onWindowDragEnd = () => {
      dragCounter = 0
      setDragActive(false)
    }

    window.addEventListener("dragenter", onWindowDragEnter)
    window.addEventListener("dragover", onWindowDragOver)
    window.addEventListener("dragleave", onWindowDragLeave)
    window.addEventListener("drop", onWindowDrop)
    window.addEventListener("dragend", onWindowDragEnd)

    return () => {
      window.removeEventListener("dragenter", onWindowDragEnter)
      window.removeEventListener("dragover", onWindowDragOver)
      window.removeEventListener("dragleave", onWindowDragLeave)
      window.removeEventListener("drop", onWindowDrop)
      window.removeEventListener("dragend", onWindowDragEnd)
    }
  }, [acceptWindowDrops, disabled])

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
    fileInputRef.current?.click()
  }

  const displayError = error || validationError || undefined
  const hasFiles = isManaged ? managedFiles.length > 0 : files.length > 0
  const fileCount = currentCount
  const canAddMore = multiple && fileCount < maxFiles

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

      {/* Primary dropzone */}
      {!hasFiles && (
        <button
          type="button"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openDialog}
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-2 p-3 rounded-[6px] border border-dashed cursor-pointer text-left",
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
            <span className="text-heading-4 text-ods-text-primary">{label}</span>
            <span className="text-heading-5 text-ods-text-secondary">{description}</span>
          </div>
        </button>
      )}

      {/* File list */}
      {hasFiles && (
        <div className="flex flex-col gap-2">
          <div
            className={cn(
              "flex flex-col gap-2 rounded-[6px] transition-colors duration-200",
              dragActive && "bg-ods-accent/5",
            )}
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
                      <p className="text-heading-5 font-medium text-ods-text-primary truncate">
                        {entry.fileName}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-heading-6 text-ods-text-secondary">
                          {formatFileSize(entry.fileSize)}
                        </span>
                        {entry.status === "uploading" && (
                          <span className="flex items-center gap-1 text-heading-6 text-ods-text-secondary">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading...
                          </span>
                        )}
                        {entry.status === "error" && (
                          <span className="text-heading-6 text-[var(--ods-attention-red-error)]">
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
                      <p className="text-heading-5 font-medium text-ods-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-heading-6 text-ods-text-secondary">
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
          {canAddMore && (
            <button
              type="button"
              onClick={openDialog}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              disabled={disabled}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-[6px]",
                "border border-dashed",
                "text-heading-5 font-medium",
                "transition-colors duration-200",
                dragActive
                  ? "border-ods-accent bg-ods-accent/5 text-ods-text-primary"
                  : "border-ods-border text-ods-text-secondary hover:border-ods-accent/30 hover:text-ods-text-primary",
                disabled && "opacity-50 cursor-not-allowed",
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
