'use client';

import { type KeyboardEvent, useState } from 'react';
import { cn } from '../../utils/cn';
import { CheckIcon, PenEditIcon, TrashIcon, XmarkIcon } from '../icons-v2-generated';
import { Input } from './input';
import { SquareAvatar } from './square-avatar';

export interface TicketNote {
  id: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  isOwn: boolean;
}

export interface TicketNoteCardProps {
  note: TicketNote;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function TicketNoteCard({ note, onEdit, onDelete, className }: TicketNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (!trimmed || !onEdit) return;
    onEdit(note.id, trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(note.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className={cn('flex items-start gap-4 rounded-[6px] p-3', 'border border-ods-border bg-ods-card', className)}>
      <SquareAvatar
        src={note.authorAvatar}
        alt={note.authorName}
        fallback={note.authorName}
        size="sm"
        variant="round"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!editText.trim()}
              className="shrink-0 text-ods-success transition-colors hover:text-ods-success/80 disabled:opacity-50"
              aria-label="Save note"
            >
              <CheckIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
              aria-label="Cancel editing"
            >
              <XmarkIcon className="size-5" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-ods-text-primary text-h4">{note.text}</p>
            <p className="truncate text-ods-text-secondary text-h6" title={`${note.authorName} • ${note.createdAt}`}>
              {note.authorName} &bull; {note.createdAt}
            </p>
          </>
        )}
      </div>
      {note.isOwn && !isEditing && (
        <div className="flex shrink-0 items-center gap-4">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              className="text-ods-text-secondary transition-colors hover:text-ods-error"
              aria-label="Delete note"
            >
              <TrashIcon className="size-6" />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-ods-text-secondary transition-colors hover:text-ods-text-primary"
              aria-label="Edit note"
            >
              <PenEditIcon className="size-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
