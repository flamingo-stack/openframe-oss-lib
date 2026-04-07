"use client"

import * as React from "react"
import type { Editor } from "@tiptap/core"
import { useEditor, EditorContent } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown, type MarkdownStorage } from "tiptap-markdown"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  SeparatorVertical,
  Heading2,
  Link as LinkIcon,
  Quote,
  Code,
  Braces,
  Image as ImageIcon,
  Table as TableIcon,
  List,
  ListOrdered,
  ListChecks,
  HelpCircle,
  Plus,
  Minus,
  Trash2,
  Rows3,
  Columns3,
} from "lucide-react"
import { cn } from "../../utils/cn"
import { markdownContentStyles } from "../../utils/markdown-content-styles"
import { FieldWrapper } from "./field-wrapper"

export interface RichTextEditorProps {
  /** Markdown string content */
  value: string
  /** Callback with updated markdown string */
  onChange: (markdown: string) => void
  /** Placeholder text shown when editor is empty */
  placeholder?: string
  /** Whether the editor is disabled */
  disabled?: boolean
  /** Label text displayed above the editor */
  label?: string
  /** Error message displayed below the editor */
  error?: string
  /** Whether to show validation error styling */
  invalid?: boolean
  /** Additional className */
  className?: string
  /** Minimum height of the editor content area. Default: 96 */
  minHeight?: number | string
}

interface ToolbarButton {
  icon: React.ElementType
  action: () => void
  isActive: () => boolean
  title: string
  type?: "separator"
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-ods-border shrink-0" />
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const toolbarRef = React.useRef<HTMLDivElement>(null)

  const buttons: (ToolbarButton | { type: "separator" })[] = [
    {
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
      title: "Bold",
    },
    {
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
      title: "Italic",
    },
    {
      icon: UnderlineIcon,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive("underline"),
      title: "Underline",
    },
    {
      icon: Strikethrough,
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive("strike"),
      title: "Strikethrough",
    },
    {
      icon: SeparatorVertical,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
      title: "Horizontal Rule",
    },
    { type: "separator" as const, icon: () => null, action: () => {}, isActive: () => false, title: "" },
    {
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive("heading", { level: 2 }),
      title: "Heading",
    },
    {
      icon: LinkIcon,
      action: () => {
        const previousUrl = editor.getAttributes("link").href
        const url = window.prompt("URL", previousUrl)
        if (url === null) return
        if (url === "") {
          editor.chain().focus().extendMarkRange("link").unsetLink().run()
          return
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
      },
      isActive: () => editor.isActive("link"),
      title: "Link",
    },
    {
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive("blockquote"),
      title: "Blockquote",
    },
    {
      icon: Code,
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
      title: "Inline Code",
    },
    {
      icon: Braces,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive("codeBlock"),
      title: "Code Block",
    },
    { type: "separator" as const, icon: () => null, action: () => {}, isActive: () => false, title: "" },
    {
      icon: ImageIcon,
      action: () => {
        const url = window.prompt("Image URL")
        if (url) {
          editor.chain().focus().setImage({ src: url }).run()
        }
      },
      isActive: () => false,
      title: "Image",
    },
    {
      icon: TableIcon,
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      isActive: () => editor.isActive("table"),
      title: "Table",
    },
    { type: "separator" as const, icon: () => null, action: () => {}, isActive: () => false, title: "" },
    {
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive("bulletList"),
      title: "Bullet List",
    },
    {
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive("orderedList"),
      title: "Ordered List",
    },
    {
      icon: ListChecks,
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive("taskList"),
      title: "Task List",
    },
    { type: "separator" as const, icon: () => null, action: () => {}, isActive: () => false, title: "" },
  ]

  return (
    <div className="relative overflow-hidden border-b border-ods-border bg-ods-bg">
      <div ref={toolbarRef} className="flex items-center overflow-x-auto scrollbar-none">
        {buttons.map((button, index) => {
          if (button.type === "separator") {
            return <ToolbarSeparator key={`sep-${index}`} />
          }

          const Icon = button.icon
          const active = button.isActive()

          return (
            <button
              key={button.title}
              type="button"
              onClick={button.action}
              title={button.title}
              className={cn(
                "flex items-center justify-center shrink-0 p-3 border-r border-ods-border",
                "transition-colors duration-150",
                "hover:bg-ods-card",
                active && "bg-ods-card text-ods-accent",
                !active && "text-ods-text-primary",
                "bg-ods-card"
              )}
            >
              <Icon className="size-5 md:size-6" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TableBubbleMenuContent({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const btnClass = cn(
    "flex items-center gap-1.5 px-2 py-1.5 rounded text-[13px] font-medium whitespace-nowrap",
    "transition-colors duration-150",
    "text-ods-text-primary hover:bg-ods-bg-hover"
  )
  const destructiveBtnClass = cn(
    btnClass,
    "text-ods-error hover:bg-ods-error/10"
  )

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-[6px] border border-ods-border bg-ods-card shadow-lg">
      <button type="button" className={btnClass} title="Add column before" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <Columns3 className="size-3.5" /><Plus className="size-3" />
      </button>
      <button type="button" className={btnClass} title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <Plus className="size-3" /><Columns3 className="size-3.5" />
      </button>
      <button type="button" className={btnClass} title="Remove column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        <Columns3 className="size-3.5" /><Minus className="size-3" />
      </button>
      <div className="w-px h-5 bg-ods-border mx-0.5" />
      <button type="button" className={btnClass} title="Add row before" onClick={() => editor.chain().focus().addRowBefore().run()}>
        <Rows3 className="size-3.5" /><Plus className="size-3" />
      </button>
      <button type="button" className={btnClass} title="Add row after" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <Plus className="size-3" /><Rows3 className="size-3.5" />
      </button>
      <button type="button" className={btnClass} title="Remove row" onClick={() => editor.chain().focus().deleteRow().run()}>
        <Rows3 className="size-3.5" /><Minus className="size-3" />
      </button>
      <div className="w-px h-5 bg-ods-border mx-0.5" />
      <button type="button" className={destructiveBtnClass} title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  disabled = false,
  label,
  error,
  invalid = false,
  className,
  minHeight = 96,
}: RichTextEditorProps) {
  const isInvalid = invalid || !!error
  const heightStyle = typeof minHeight === "number" ? `${minHeight}px` : minHeight

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-ods-accent underline" },
      }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      const md = ((ed.storage as Record<string, any>).markdown as MarkdownStorage).getMarkdown()
      onChange(md)
    },
    editorProps: {
      attributes: {
        class: cn(
          markdownContentStyles,
          "focus:outline-none",
          // Placeholder (editor-specific)
          "[&_p.is-editor-empty:first-child::before]:text-ods-text-secondary",
          "[&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_p.is-editor-empty:first-child::before]:float-left",
          "[&_p.is-editor-empty:first-child::before]:h-0",
          "[&_p.is-editor-empty:first-child::before]:pointer-events-none",
        ),
      },
    },
  })

  // Sync external value changes
  React.useEffect(() => {
    if (!editor) return
    const currentMd = ((editor.storage as Record<string, any>).markdown as MarkdownStorage).getMarkdown()
    if (value !== currentMd) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // Sync editable state
  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  return (
    <FieldWrapper label={label} error={error} className={className}>
      <div
        className={cn(
          "rounded-[6px] border overflow-hidden",
          "bg-ods-bg border-ods-border",
          "transition-colors duration-200",
          isInvalid && "border-ods-error",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <EditorToolbar editor={editor} />
        <div
          className="relative bg-ods-card p-3 resize-y overflow-auto"
          style={{ minHeight: heightStyle }}
        >
          <EditorContent editor={editor} />
          {editor && (
            <BubbleMenu
              editor={editor}
              shouldShow={({ editor: ed }) => ed.isActive("table")}
            >
              <TableBubbleMenuContent editor={editor} />
            </BubbleMenu>
          )}
        </div>
      </div>
    </FieldWrapper>
  )
}
