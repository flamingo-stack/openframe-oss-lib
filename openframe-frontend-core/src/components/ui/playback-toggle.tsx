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
 * never the thing the eye lands on: no border and no surface, a muted glyph
 * that comes up to full strength on hover and focus. While the visitor HAS
 * stopped it, the glyph stays at secondary strength, so the way back to
 * playing is not lost.
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
        'shrink-0 rounded-full hover:text-ods-text-primary focus-visible:text-ods-text-primary',
        paused ? 'text-ods-text-secondary' : 'text-ods-text-muted',
        className,
      )}
      aria-label={paused ? playLabel : pauseLabel}
      aria-pressed={paused}
      onClick={() => onChange(!paused)}
    >
      {paused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
    </Button>
  );
}
