'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { InfoHint } from '../../ui/info-hint';
import { SearchInput } from '../../ui/search-input';

/** How long the box waits after the last keystroke before it asks the server. */
const SEARCH_DEBOUNCE_MS = 300;

export interface BlockedSendersSearchProps {
  /** The search the list answers now (from the address). */
  value: string;
  /** A new search: the host puts it in the address, and the list reads it from the server. */
  onSearch: (value: string) => void;
  placeholder: string;
  /** What the tab lists and how, as the lib's info hint beside the box (never a paragraph above the list). */
  hint?: ReactNode;
  /** What the hint is about, for its button's name. */
  hintLabel?: string;
}

/** A tab's search box. The text is the person's; the list is filtered on the server, never here. */
export function BlockedSendersSearch({ value, onSearch, placeholder, hint, hintLabel }: BlockedSendersSearchProps) {
  const [text, setText] = useState(value);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);
  const appliedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPending = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    const next = text.trim();
    if (next === appliedRef.current) return undefined;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      appliedRef.current = next;
      onSearchRef.current(next);
    }, SEARCH_DEBOUNCE_MS);
    return cancelPending;
  }, [text]);

  const box = (
    <SearchInput
      className="w-full content-md:max-w-[360px]"
      placeholder={placeholder}
      value={text}
      onChange={setText}
      onSubmit={submitted => {
        // Enter searches now: the debounce still waiting on the last keystroke would ask again.
        cancelPending();
        const next = submitted.trim();
        appliedRef.current = next;
        setText(submitted);
        onSearchRef.current(next);
      }}
      showDropdown={false}
      debounceMs={0}
    />
  );
  if (!hint) return box;
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)]">
      {box}
      <InfoHint label={hintLabel}>{hint}</InfoHint>
    </div>
  );
}
