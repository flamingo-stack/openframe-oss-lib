'use client';

import { cn } from '../../utils/cn';
import { PauseIcon } from '../icons-v2-generated/media-playback/pause-icon';
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon';
import { Button } from './button';

export interface PlaybackToggleProps {
  paused: boolean;
  onChange: (paused: boolean) => void;
  /** The control's name while stopped ("Play demo"). */
  playLabel?: string;
  /** The control's name while moving ("Pause demo"). */
  pauseLabel?: string;
  className?: string;
}

/**
 * THE stop/start control of anything that moves on its own (WCAG 2.2.2): one
 * small icon button beside what it controls. A looping demo and an
 * auto-advancing carousel show the same one, wired to `useAutoplay`'s
 * `paused` / `setPaused`.
 *
 * It has to be there and easy to reach (a 32px target, a name, a focus ring),
 * never the thing the eye lands on: no border and no surface, only a small
 * grey glyph that takes the accent on hover and focus. The grey is the muted
 * text token, the quietest one that still clears the 3:1 a control's glyph
 * needs against the page (WCAG 1.4.11); the next grey down does not. The
 * target stays 32px; it is the glyph that is small.
 */
export function PlaybackToggle({
  paused,
  onChange,
  playLabel = 'Play',
  pauseLabel = 'Pause',
  className,
}: PlaybackToggleProps) {
  return (
    <Button
      variant="transparent"
      size="icon-sm"
      className={cn(
        'shrink-0 rounded-full border-0 text-ods-text-muted hover:text-ods-accent focus-visible:text-ods-accent [&_svg]:h-3 [&_svg]:w-3',
        className,
      )}
      aria-label={paused ? playLabel : pauseLabel}
      aria-pressed={paused}
      onClick={() => onChange(!paused)}
    >
      {paused ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
    </Button>
  );
}
