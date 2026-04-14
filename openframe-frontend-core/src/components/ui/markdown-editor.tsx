"use client"

import React, { useRef, useCallback, useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Loader2, Upload } from "lucide-react"
import { cn } from "../../utils/cn"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

const MARKDOWN_EDITOR_STYLE_ID = "ods-markdown-editor-styles"

const mdEditorCSS = `
:root { --md-editor-text-color: var(--color-text-primary) !important; }
body .w-md-editor { background-color: var(--color-bg) !important; border: 1px solid var(--ods-system-greys-soft-grey) !important; border-radius: 6px !important; --md-editor-text-color: var(--color-text-primary) !important; --md-editor-box-shadow-color: transparent !important; box-shadow: none !important; }
body .w-md-editor-area, body .w-md-editor-input, body .w-md-editor-text, body .w-md-editor-text-pre, body .w-md-editor-text-input, body .w-md-editor-text-textarea { background-color: var(--color-bg-card) !important; color: var(--color-text-primary) !important; font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; font-size: 18px !important; font-weight: 500 !important; line-height: 24px !important; padding: 16px !important; }
body .w-md-editor-text-textarea::placeholder { color: var(--color-text-secondary) !important; font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; font-size: 18px !important; font-weight: 500 !important; }
body .w-md-editor-text .token, body .w-md-editor-text-pre .token, body .w-md-editor-text-textarea, body .w-md-editor-text-input { color: var(--color-text-primary) !important; }
body .w-md-editor-text-pre *, body .w-md-editor-text-textarea *, body .w-md-editor-text-input *, body .w-md-editor-text * { color: var(--color-text-primary) !important; }
body .w-md-editor-text-pre .token.title, body .w-md-editor-text-pre .token.bold, body .w-md-editor-text-pre .token.code, body .w-md-editor-text-pre .token.string, body .w-md-editor-text-pre .token.keyword { color: var(--color-text-primary) !important; }
body .w-md-editor-text-textarea, body .w-md-editor-text-input, body .w-md-editor-text-pre { color: var(--color-text-primary) !important; -webkit-text-fill-color: var(--color-text-primary) !important; text-shadow: none !important; filter: brightness(1) contrast(1) !important; }
body .w-md-editor { color: var(--color-text-primary) !important; }
body .w-md-editor *:not(.w-md-editor-toolbar *, .w-md-editor-preview *, .custom-preview-wrapper *) { color: var(--color-text-primary) !important; -webkit-text-fill-color: var(--color-text-primary) !important; }
.w-md-editor-toolbar { background-color: var(--color-bg) !important; border-bottom: 1px solid var(--color-border-default) !important; padding: 12px 16px !important; }
.w-md-editor-toolbar ul li button { background: transparent !important; border: none !important; color: var(--color-text-primary) !important; padding: 8px 12px !important; border-radius: 6px !important; transition: all 0.2s ease !important; min-height: 36px !important; min-width: 36px !important; }
.w-md-editor-toolbar ul li button:hover { background-color: var(--color-border-default) !important; color: var(--ods-accent) !important; }
.w-md-editor-toolbar ul li button.active, .w-md-editor-toolbar ul li button[aria-pressed="true"] { background-color: var(--ods-accent) !important; color: var(--color-text-on-accent) !important; }
.w-md-editor-toolbar-divider { display: none !important; }
.w-md-editor-preview { background-color: var(--color-bg) !important; color: var(--color-text-primary) !important; border-left: 1px solid var(--color-border-default) !important; --color-border-default: var(--ods-system-greys-soft-grey) !important; --color-border-muted: var(--ods-system-greys-soft-grey) !important; --color-fg-muted: var(--ods-system-greys-grey) !important; }
.w-md-editor-text { border-top: 1px solid var(--color-border-default) !important; }
.w-md-editor-focus { border-color: var(--ods-accent) !important; }
body .w-md-editor .w-md-editor-bar { width: 24px !important; height: 12px !important; margin-left: auto !important; margin-right: 8px !important; cursor: ns-resize !important; }
body .w-md-editor .w-md-editor-bar svg { display: none !important; }
body .w-md-editor .w-md-editor-bar::after { content: '' !important; display: block !important; width: 24px !important; height: 4px !important; border-top: 2px solid var(--color-border-default) !important; border-bottom: 2px solid var(--color-border-default) !important; margin-top: 2px !important; border-radius: 1px !important; }
body .w-md-editor .w-md-editor-bar:hover::after { border-color: var(--color-text-secondary) !important; }
`

function MarkdownEditorStyles() {
  useEffect(() => {
    if (document.getElementById(MARKDOWN_EDITOR_STYLE_ID)) return
    const style = document.createElement("style")
    style.id = MARKDOWN_EDITOR_STYLE_ID
    style.textContent = mdEditorCSS
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, [])
  return null
}

export interface MarkdownEditorProps {
  /** Markdown string content */
  value: string
  /** Callback with updated markdown string */
  onChange: (markdown: string) => void
  /** Placeholder text shown when editor is empty */
  placeholder?: string
  /** Whether the editor is disabled */
  disabled?: boolean
  /** Initial editor height in pixels (default: 600). User can resize via drag handle. */
  height?: number
  /** Minimum editor height in pixels (default: 100) */
  minHeight?: number
  /** Additional className for the wrapper */
  className?: string
  /**
   * File upload handler. Return the public URL of the uploaded file.
   * If not provided, the upload button is hidden.
   */
  onUploadFile?: (file: File) => Promise<string>
  /** Called after a file is successfully uploaded and inserted */
  onFileUploaded?: (url: string, filename: string) => void
  /** Custom preview renderer. Receives the markdown source string. */
  renderPreview?: (source: string) => React.ReactNode
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  height = 600,
  minHeight = 100,
  className,
  onUploadFile,
  onFileUploaded,
  renderPreview,
}: MarkdownEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [defaultExtraCommands, setDefaultExtraCommands] = useState<any[]>([])

  useEffect(() => {
    import("@uiw/react-md-editor").then((mod) => {
      if (mod.commands?.getExtraCommands) {
        setDefaultExtraCommands(mod.commands.getExtraCommands())
      }
    })
  }, [])

  const handleChange = (val?: string) => {
    onChange(val || "")
  }

  const insertTextAtCursor = useCallback(
    (text: string) => {
      const textarea = document.querySelector(
        ".w-md-editor-text-textarea"
      ) as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.slice(0, start) + text + value.slice(end)
        onChange(newValue)
      } else {
        onChange(value + "\n" + text)
      }
    },
    [value, onChange]
  )

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!onUploadFile) return

      setIsUploading(true)
      setUploadProgress(`Uploading ${file.name}...`)

      try {
        const url = await onUploadFile(file)
        const isImage = file.type.startsWith("image/")
        const markdown = isImage
          ? `![${file.name}](${url})`
          : `[${file.name}](${url})`
        insertTextAtCursor(markdown)
        onFileUploaded?.(url, file.name)
      } catch (error) {
        console.error("File upload failed:", error)
        setUploadProgress("Upload failed. Please try again.")
      } finally {
        setIsUploading(false)
        setTimeout(() => setUploadProgress(""), 3000)
      }
    },
    [onUploadFile, insertTextAtCursor, onFileUploaded]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileUpload(file)
        e.target.value = ""
      }
    },
    [handleFileUpload]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!onUploadFile) return
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) handleFileUpload(file)
          return
        }
      }
    },
    [onUploadFile, handleFileUpload]
  )

  const CustomPreview = ({ source }: { source: string }) => {
    if (renderPreview) {
      return (
        <div style={{ padding: "16px", height: "100%", overflow: "auto" }}>
          {renderPreview(source)}
        </div>
      )
    }
    return null
  }

  const uploadCommand = onUploadFile
    ? {
        name: "upload",
        keyCommand: "upload",
        buttonProps: { "aria-label": "Upload file", title: "Upload file" },
        icon: isUploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Upload className="w-3 h-3" />
        ),
        execute: () => {
          fileInputRef.current?.click()
        },
      }
    : null

  const extraCommands = uploadCommand
    ? [...defaultExtraCommands, uploadCommand]
    : defaultExtraCommands

  const wrapperRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const mouseYRef = useRef(0)
  const rafRef = useRef<number>(0)
  const scrollParentRef = useRef<HTMLElement | Window>(window)

  const EDGE_ZONE = 60
  const MAX_SCROLL_SPEED = 15

  const findScrollParent = useCallback((el: HTMLElement | null): HTMLElement | Window => {
    let node = el?.parentElement
    while (node && node !== document.documentElement) {
      const { overflowY } = window.getComputedStyle(node)
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        return node
      }
      node = node.parentElement
    }
    return window
  }, [])

  const scrollLoop = useCallback(() => {
    if (!isDraggingRef.current) return
    const parent = scrollParentRef.current
    const isWindow = parent === window
    const viewportBottom = isWindow
      ? window.innerHeight
      : (parent as HTMLElement).getBoundingClientRect().bottom
    const distFromBottom = viewportBottom - mouseYRef.current
    if (distFromBottom < EDGE_ZONE) {
      const speed = Math.ceil(MAX_SCROLL_SPEED * (1 - distFromBottom / EDGE_ZONE))
      if (isWindow) {
        window.scrollBy(0, speed)
      } else {
        (parent as HTMLElement).scrollTop += speed
      }
    }
    rafRef.current = requestAnimationFrame(scrollLoop)
  }, [])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onMouseMove = (e: MouseEvent) => { mouseYRef.current = e.clientY }

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".w-md-editor-bar")) {
        isDraggingRef.current = true
        mouseYRef.current = e.clientY
        scrollParentRef.current = findScrollParent(wrapper)
        window.addEventListener("mousemove", onMouseMove)
        rafRef.current = requestAnimationFrame(scrollLoop)
      }
    }

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        window.removeEventListener("mousemove", onMouseMove)
        cancelAnimationFrame(rafRef.current)
      }
    }

    wrapper.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      wrapper.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("mousemove", onMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [scrollLoop, findScrollParent])

  return (
    <div
      ref={wrapperRef}
      className={cn("advanced-blog-editor", className)}
      onPaste={handlePaste}
    >
      {onUploadFile && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
        />
      )}

      {!MDEditor && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
      {MDEditor && (
        <MDEditor
          value={value}
          onChange={handleChange}
          preview="live"
          hideToolbar={false}
          visibleDragbar={true}
          height={height}
          minHeight={minHeight}
          extraCommands={extraCommands}
          style={
            {
              "--md-editor-text-color": "var(--color-text-primary)",
              "--md-editor-bg-color": "var(--color-bg-card)",
              "--md-editor-border-color": "var(--color-border)"
            } as any
          }
          components={
            renderPreview
              ? {
                  preview: (source) => {
                    return <CustomPreview source={source} />
                  },
                }
              : undefined
          }
          textareaProps={{
            placeholder,
            disabled,
            style: {
              fontFamily:
                'DM Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: "18px",
              fontWeight: 500,
              lineHeight: "24px",
              color: "var(--color-text-primary)",
              backgroundColor: "var(--color-bg-card)",
            },
          }}
          data-color-mode="dark"
        />
      )}

      {uploadProgress && (
        <p className="text-xs text-ods-text-secondary mt-1">{uploadProgress}</p>
      )}

      <MarkdownEditorStyles />
    </div>
  )
}
