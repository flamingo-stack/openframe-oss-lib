"use client"

import * as React from "react"
import { Chevron02DownIcon } from "../icons-v2-generated/arrows/chevron-02-down-icon"
import { cn } from "../../utils/cn"
import { SquareAvatar } from "./square-avatar"
import { Tag, type TagProps } from "./tag"
import { TicketDetailSection } from "./ticket-detail-section"
import { type TicketAttachment, TicketAttachmentsList } from "./ticket-attachments-list"
import { type KnowledgeBaseArticle, TicketKnowledgeBaseList } from "./ticket-knowledge-base-list"
import type { TicketNote } from "./ticket-note-card"
import { TicketNotesSection } from "./ticket-notes-section"
import { SimpleMarkdownRenderer } from "./simple-markdown-renderer"

export interface TicketInfoSectionProps {
  /** Organization name and image */
  organization?: {
    name: string
    imageSrc?: string
  }
  /** User name */
  user?: string
  /** Device info */
  device?: {
    name: string
    icon?: React.ReactNode
    onClick?: () => void
  }
  /** Status tag */
  statusTag?: {
    label: string
    variant?: TagProps["variant"]
  }
  /** Expand button click handler */
  onExpand?: () => void
  /** Whether the section is expanded */
  expanded?: boolean
  /** Additional className */
  className?: string

  // --- Expanded view props ---

  /** Assigned person info */
  assigned?: {
    name: string
    statusTag?: { label: string; variant?: TagProps["variant"] }
  }
  /** Created date string */
  createdAt?: string
  /** Ticket description — markdown/HTML content */
  description?: string
  /** File attachments (view-only with download) */
  attachments?: TicketAttachment[]
  /** Tag labels */
  tags?: string[]
  /** Knowledge base articles */
  knowledgeBaseArticles?: KnowledgeBaseArticle[]
  /** Notes */
  notes?: TicketNote[]
  onAddNote?: (text: string) => void
  onEditNote?: (id: string, text: string) => void
  onDeleteNote?: (id: string) => void
  /** Disables the note input while a note is being added */
  isAddingNote?: boolean
}

function InfoCell({ value, label, icon, onClick }: {
  value: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1 w-full min-w-0">
          {icon && (
            <span className="shrink-0 size-4 flex items-center justify-center text-ods-text-secondary">
              {icon}
            </span>
          )}
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="text-h4 text-ods-text-primary truncate hover:text-ods-accent transition-colors cursor-pointer text-left"
            >
              {value}
            </button>
          ) : (
            <span className="text-h4 text-ods-text-primary truncate">{value}</span>
          )}
        </div>
        <span className="text-h6 text-ods-text-secondary truncate">{label}</span>
      </div>
    </div>
  )
}

export function TicketInfoSection({
  organization,
  user,
  device,
  statusTag,
  onExpand,
  expanded = false,
  className,
  assigned,
  createdAt,
  description,
  attachments,
  tags,
  knowledgeBaseArticles,
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  isAddingNote,
}: TicketInfoSectionProps) {
  return (
    <div
      className={cn(
        "rounded-[6px] border border-ods-border overflow-hidden",
        className,
      )}
    >
      {/* Header row */}
      <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-3 bg-ods-card border-b border-ods-border items-center">
        {/* Organization with image */}
        <div className="flex items-center gap-2 min-w-0">
          <SquareAvatar
            src={organization?.imageSrc}
            alt={organization?.name}
            fallback={organization?.name || "Org"}
            size="md"
            className="shrink-0"
          />
          <InfoCell value={organization?.name || "Unassigned"} label="Organization" />
        </div>

        {/* User */}
        <InfoCell value={user || "Unassigned"} label="User" />

        {/* Device */}
        <InfoCell
          value={device?.name || "Unassigned"}
          label="Device"
          icon={device?.icon}
          onClick={device?.onClick}
        />

        {/* Status tag + expand button */}
        <div className="flex items-center gap-4 min-w-0">
          {statusTag && (
            <div className="min-w-0">
              <Tag label={statusTag.label} variant={statusTag.variant} />
            </div>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className={cn(
                "shrink-0 flex items-center justify-center p-3 rounded-[6px]",
                "bg-ods-card border border-ods-border",
                "hover:bg-ods-bg-hover transition-colors duration-150",
              )}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <Chevron02DownIcon
                className={cn(
                  "size-6 text-ods-text-primary transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {/* Second info row: Assigned + Created */}
          {(assigned || createdAt) && (
            <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-ods-bg border-b border-ods-border items-center">
              {assigned && (
                <InfoCell value={assigned.name} label="Assigned" />
              )}
              {createdAt && (
                <InfoCell value={createdAt} label="Created" />
              )}
            </div>
          )}

          {/* Content area */}
          <div className="flex flex-col gap-4 p-4 bg-ods-bg border-b border-ods-border">
            {/* Description */}
            {description && (
              <SimpleMarkdownRenderer content={description} />
            )}

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <TicketDetailSection label="Attachments">
                <TicketAttachmentsList attachments={attachments} />
              </TicketDetailSection>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <TicketDetailSection label="Tags">
                <div className="flex flex-wrap gap-2 min-w-0">
                  {tags.map(tag => (
                    <Tag key={tag} label={tag} variant="outline" className="max-w-full" />
                  ))}
                </div>
              </TicketDetailSection>
            )}

            {/* Knowledge Base Articles */}
            {knowledgeBaseArticles && knowledgeBaseArticles.length > 0 && (
              <TicketDetailSection label="Knowledge Base Articles">
                <TicketKnowledgeBaseList articles={knowledgeBaseArticles} />
              </TicketDetailSection>
            )}

            {/* Notes */}
            {(notes || onAddNote) && (
              <TicketDetailSection label="Notes">
                <TicketNotesSection
                  notes={notes || []}
                  onAddNote={onAddNote}
                  onEditNote={onEditNote}
                  onDeleteNote={onDeleteNote}
                  isAddingNote={isAddingNote}
                />
              </TicketDetailSection>
            )}
          </div>
        </>
      )}
    </div>
  )
}
