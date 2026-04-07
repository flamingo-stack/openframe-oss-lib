"use client"

import * as React from "react"
import { CheckIcon } from "../icons-v2-generated/signs-and-symbols/check-icon"
import { PencilIcon } from "../icons-v2-generated/design/pencil-icon"
import { TrashIcon } from "../icons-v2-generated/interface/trash-icon"
import { XmarkIcon } from "../icons-v2-generated/signs-and-symbols/xmark-icon"
import { cn } from "../../utils/cn"
import { Input } from "./input"
import { SquareAvatar } from "./square-avatar"

export interface TicketNote {
  id: string
  text: string
  authorName: string
  authorAvatar?: string
  createdAt: string
  isOwn: boolean
}

export interface TicketNoteCardProps {
  note: TicketNote
  onEdit?: (id: string, text: string) => void
  onDelete?: (id: string) => void
  className?: string
}

export function TicketNoteCard({ note, onEdit, onDelete, className }: TicketNoteCardProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editText, setEditText] = React.useState(note.text)

  const handleSave = () => {
    const trimmed = editText.trim()
    if (!trimmed || !onEdit) return
    onEdit(note.id, trimmed)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditText(note.text)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      handleCancel()
    }
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 p-3 rounded-[6px]",
        "bg-ods-card border border-ods-border",
        className,
      )}
    >
      <SquareAvatar
        src={note.authorAvatar}
        alt={note.authorName}
        fallback={note.authorName}
        size="sm"
        variant="round"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!editText.trim()}
              className="shrink-0 text-ods-success hover:text-ods-success/80 transition-colors disabled:opacity-50"
              aria-label="Save note"
            >
              <CheckIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
              aria-label="Cancel editing"
            >
              <XmarkIcon className="size-5" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-h4 text-ods-text-primary">{note.text}</p>
            <p className="text-h6 text-ods-text-secondary truncate">
              {note.authorName} &bull; {note.createdAt}
            </p>
          </>
        )}
      </div>
      {note.isOwn && !isEditing && (
        <div className="flex items-center gap-4 shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              className="text-ods-text-secondary hover:text-ods-error transition-colors"
              aria-label="Delete note"
            >
              <TrashIcon className="size-6" />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-ods-text-secondary hover:text-ods-text-primary transition-colors"
              aria-label="Edit note"
            >
              <PencilIcon className="size-6" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
