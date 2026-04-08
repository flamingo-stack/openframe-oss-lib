"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "../../utils/cn"

export interface KnowledgeBaseArticle {
  id: string
  title: string
  description: string
  onClick?: () => void
}

export interface TicketKnowledgeBaseListProps {
  articles: KnowledgeBaseArticle[]
  className?: string
}

export function TicketKnowledgeBaseList({ articles, className }: TicketKnowledgeBaseListProps) {
  if (articles.length === 0) return null

  return (
    <div className={cn("rounded-[6px] border border-ods-border overflow-hidden", className)}>
      {articles.map((article, index) => (
        <button
          key={article.id}
          type="button"
          onClick={article.onClick}
          className={cn(
            "flex items-center gap-4 px-4 py-3 w-full text-left bg-ods-card",
            "hover:bg-ods-bg-hover transition-colors",
            index < articles.length - 1 && "border-b border-ods-border",
          )}
        >
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-h4 text-ods-text-primary truncate">{article.title}</p>
            <p className="text-h6 text-ods-text-secondary truncate">{article.description}</p>
          </div>
          <ChevronRight className="shrink-0 size-6 text-ods-text-secondary" />
        </button>
      ))}
    </div>
  )
}
