"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import { cn } from "../../utils/cn"
import { markdownContentStyles } from "../../utils/markdown-content-styles"

export interface TicketDescriptionViewerProps {
  /** Markdown or HTML content to display */
  content: string
  className?: string
}

/**
 * Renders ticket description content (markdown)
 */
export function TicketDescriptionViewer({ content, className }: TicketDescriptionViewerProps) {
  if (!content) return null

  return (
    <div className={cn(markdownContentStyles, "w-full overflow-hidden", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
