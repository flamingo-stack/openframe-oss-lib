'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

export interface ChatHeaderRenameFieldProps {
  /** The chat's current title; selected on mount, so typing replaces it. */
  initialValue: string;
  /** Enter, or the field losing focus. Fired with the raw value: the host
   *  decides what an empty or unchanged title means. */
  onSubmit: (value: string) => void;
  /** Escape. Nothing is saved. */
  onCancel: () => void;
  className?: string;
}

/**
 * Inline rename for the chat header's title: the title cell becomes this field,
 * its text selected. Enter saves, Escape cancels, blur saves. Settles once —
 * the header unmounts it on either outcome, and a blur from that unmount must
 * not save a second time (or save after a cancel).
 */
export function ChatHeaderRenameField({ initialValue, onSubmit, onCancel, className }: ChatHeaderRenameFieldProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, []);

  const settle = (save: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (save) onSubmit(value);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      value={value}
      aria-label="Chat name"
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        // An IME commits its candidate with Enter: that keystroke is not a save.
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          settle(true);
        } else if (e.key === 'Escape') {
          // The page may read Escape too (e.g. as "back"): this one is ours.
          e.preventDefault();
          e.stopPropagation();
          settle(false);
        }
      }}
      onBlur={() => settle(true)}
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-ods-accent bg-ods-bg px-[var(--spacing-system-xs)] text-ods-text-primary outline-none text-h3',
        className,
      )}
    />
  );
}
