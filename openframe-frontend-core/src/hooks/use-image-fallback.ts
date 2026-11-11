'use client';

import { useCallback, useState } from 'react';

export interface ImageFallback {
  /** The first candidate that has not failed, else null: draw your own fallback (initials, a placeholder, nothing). */
  src: string | null;
  /** Wire to the picture's `onError`. */
  onError: () => void;
}

/**
 * A picture's fallback chain, keyed by URL: how a component falls back from a picture that did not load
 * (`SquareAvatar`, `EntityImage`, `ChatMessageRow`, the entity cards' covers). State is the SET of URLs that failed
 * and `src` is derived, so a new URL is simply not one of them: the picture comes back with no reset effect, and a
 * URL that failed once is not retried in a loop. Never hide the element or reveal a fallback by writing to the DOM
 * in `onError` instead (the legacy `hideOnError`): React does not undo the write, so the fallback outlives the URL
 * it was about.
 */
export function useImageFallback(...candidates: (string | null | undefined)[]): ImageFallback {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const src = candidates.find((candidate): candidate is string => !!candidate && !failed.has(candidate)) ?? null;

  const onError = useCallback(() => {
    if (!src) return;
    setFailed(prev => new Set(prev).add(src));
  }, [src]);

  return { src, onError };
}
