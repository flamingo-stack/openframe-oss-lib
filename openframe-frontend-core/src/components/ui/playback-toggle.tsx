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
 * small, quiet round icon button. A looping demo and an auto-advancing
 * carousel show the same one, wired to `useAutoplay`'s `paused` / `setPaused`.
 * Quiet on purpose: it takes the accent only on hover, so it never competes
 * with what it controls.
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
        'shrink-0 rounded-full border border-ods-border text-ods-text-secondary hover:border-ods-accent hover:text-ods-accent',
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
