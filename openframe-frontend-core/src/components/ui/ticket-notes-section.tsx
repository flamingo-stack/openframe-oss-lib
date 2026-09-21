'use client';

import { type KeyboardEvent, useState } from 'react';
import { cn } from '../../utils/cn';
import { Send03Icon } from '../icons-v2-generated';
import { Input } from './input';
import { type TicketNote, TicketNoteCard } from './ticket-note-card';

export interface TicketNotesSectionProps {
  notes: TicketNote[];
  onAddNote?: (text: string) => void;
  onEditNote?: (id: string, text: string) => void;
  onDeleteNote?: (id: string) => void;
  /** Disables the input and send button while a note is being added */
  isAddingNote?: boolean;
  className?: string;
}

export function TicketNotesSection({
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  isAddingNote,
  className,
}: TicketNotesSectionProps) {
  const [noteText, setNoteText] = useState('');

  const handleSend = () => {
    const trimmed = noteText.trim();
    if (!trimmed || !onAddNote || isAddingNote) return;
    onAddNote(trimmed);
    setNoteText('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {notes.map(note => (
        <TicketNoteCard key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} />
      ))}

      {onAddNote && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your Note Here"
              disabled={isAddingNote}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!noteText.trim() || isAddingNote}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] md:h-12 md:w-12',
              'border border-ods-border bg-ods-card',
              'transition-colors hover:bg-ods-bg-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            aria-label="Send note"
          >
            <Send03Icon className="size-6 text-ods-text-secondary" />
          </button>
        </div>
      )}
    </div>
  );
}
