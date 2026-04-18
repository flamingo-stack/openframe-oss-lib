"use client"

import * as React from "react"
import { Chevron02DownIcon } from "../icons-v2-generated/arrows/chevron-02-down-icon"
import { PenEditIcon } from "../icons-v2-generated/design/pen-edit-icon"
import { UserIcon } from "../icons-v2-generated/users/user-icon"
import { cn } from "../../utils/cn"
import { Autocomplete, type AutocompleteOption } from "./autocomplete"
import { SquareAvatar } from "./square-avatar"
import { Tag } from "./tag"
import { TicketStatusTag } from "./ticket-status-tag"
import { TicketDetailSection } from "./ticket-detail-section"
import { type TicketAttachment, TicketAttachmentsList } from "./ticket-attachments-list"
import { type KnowledgeBaseArticle, TicketKnowledgeBaseList } from "./ticket-knowledge-base-list"
import type { TicketNote } from "./ticket-note-card"
import { TicketNotesSection } from "./ticket-notes-section"
import { SimpleMarkdownRenderer } from "./simple-markdown-renderer"

export interface TicketAssigneeOption {
  value: string
  label: string
  imageUrl?: string
}

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
  status?: string
  /** Expand button click handler */
  onExpand?: () => void
  /** Whether the section is expanded */
  expanded?: boolean
  /** Additional className */
  className?: string

  // --- Expanded view props ---

  /** Assigned person info with inline dropdown */
  assigned?: {
    currentAssignee?: {
      id: string
      name: string
      avatarSrc?: string
    }
    options: TicketAssigneeOption[]
    isLoading?: boolean
    isPending?: boolean
    onAssign: (userId: string | null) => void
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

function AssignedDropdown({ assigned }: { assigned: NonNullable<TicketInfoSectionProps['assigned']> }) {
  const [isEditing, setIsEditing] = React.useState(false)
  const hasAssignee = !!assigned.currentAssignee

  const renderOption = React.useCallback((option: AutocompleteOption) => {
    const opt = option as TicketAssigneeOption
    return (
      <div className="flex items-center gap-3 w-full min-w-0">
        <SquareAvatar
          src={opt.imageUrl}
          alt={opt.label}
          fallback={opt.label}
          size="sm"
          variant="round"
          className="h-6 w-6 shrink-0"
        />
        <span className="truncate">{opt.label}</span>
      </div>
    )
  }, [])

  if (!isEditing) {
    return hasAssignee ? (
      <div className="flex items-center gap-2 min-w-0">
        <SquareAvatar
          src={assigned.currentAssignee!.avatarSrc}
          alt={assigned.currentAssignee!.name}
          fallback={assigned.currentAssignee!.name || "User"}
          size="md"
          variant="round"
          className="shrink-0"
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1 w-full min-w-0">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 cursor-pointer group text-left"
              >
                <PenEditIcon className="size-4 shrink-0 text-ods-text-secondary group-hover:text-ods-accent transition-colors" />
                <span className="text-h4 text-ods-text-primary truncate">{assigned.currentAssignee!.name}</span>
              </button>
            </div>
            <span className="text-h6 text-ods-text-secondary truncate">Assigned</span>
          </div>
        </div>
      </div>
    ) : (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 text-h4 text-ods-accent underline truncate cursor-pointer hover:opacity-80 transition-opacity text-left"
        >
          <UserIcon className="size-4 shrink-0" />
          <span>Assign User</span>
        </button>
        <span className="text-h6 text-ods-text-secondary truncate block">Assigned</span>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <Autocomplete
        options={assigned.options}
        value={assigned.currentAssignee?.id ?? null}
        onChange={(val) => {
          assigned.onAssign(val)
          setIsEditing(false)
        }}
        placeholder="Search users..."
        loading={assigned.isLoading}
        showChevron={false}
        startAdornment={
          hasAssignee ? (
            <SquareAvatar
              src={assigned.currentAssignee!.avatarSrc}
              alt={assigned.currentAssignee!.name}
              fallback={assigned.currentAssignee!.name || "User"}
              size="sm"
              variant="round"
              className="h-6 w-6"
            />
          ) : (
            <UserIcon className="size-5 text-ods-text-secondary" />
          )
        }
        renderOption={renderOption}
      />
      <span className="text-h6 text-ods-text-secondary truncate block mt-0.5">Assigned</span>
    </div>
  )
}

export function TicketInfoSection({
  organization,
  device,
  status,
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

        {/* Assigned */}
        <div className="min-w-0">
          {assigned ? (
            <AssignedDropdown assigned={assigned} />
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-h4 text-ods-text-secondary">
                <UserIcon className="size-4 shrink-0" />
                <span className="truncate">Unassigned</span>
              </div>
              <span className="text-h6 text-ods-text-secondary truncate block">Assigned</span>
            </div>
          )}
        </div>

        {/* Device */}
        <InfoCell
          value={device?.name || "Unassigned"}
          label="Device"
          icon={device?.icon}
          onClick={device?.onClick}
        />

        {/* Status tag + expand button */}
        <div className="flex items-center gap-4 min-w-0">
          {status && (
            <div className="min-w-0">
              <TicketStatusTag status={status} />
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
          {/* Second info row: Created */}
          {createdAt && (
            <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-ods-bg border-b border-ods-border items-center">
              <InfoCell value={createdAt} label="Created" />
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
