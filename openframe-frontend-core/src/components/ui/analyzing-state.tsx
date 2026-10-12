import { cn } from '../../utils/cn';
import { ChatTypingIndicator } from '../chat/chat-typing-indicator';
import { Skeleton } from './skeleton';

export interface AnalyzingStateProps {
  /** What is being worked on, as a sentence with no closing mark ("Mingo is analyzing your logs"). */
  label: string;
  className?: string;
}

/** How far each row being read has faded: the list trails off instead of ending. */
const ROW_OPACITY = ['opacity-100', 'opacity-60', 'opacity-30'] as const;
/** Each row pulses a beat after the one above it, so the eye reads them as a scan. */
const ROW_STAGGER_MS = 200;

/**
 * THE "it is working, nothing to show yet" state of a feed or a window: three
 * rows still being read, pulsing one after another, over the caller's words
 * and the chat's own typing dots. It says an agent is at work, where a bare
 * sentence in an empty box reads as idle.
 *
 * Built from the shared pieces only: `Skeleton` for the rows and
 * `ChatTypingIndicator` for the dots. Still under reduced motion. It is
 * announced as a status; the rows and dots are decoration.
 */
export function AnalyzingState({ label, className }: AnalyzingStateProps) {
  return (
    <div role="status" className={cn('flex w-full max-w-sm flex-col items-center gap-4', className)}>
      <div aria-hidden className="grid w-full grid-cols-1 gap-2">
        {ROW_OPACITY.map((opacity, row) => {
          const delay = { animationDelay: `${row * ROW_STAGGER_MS}ms` };
          return (
            <div
              key={opacity}
              className={cn(
                'flex items-center gap-3 rounded-md border border-ods-border bg-ods-bg px-3.5 py-3',
                opacity,
              )}
            >
              <Skeleton
                className="h-2 w-2 shrink-0 rounded-full bg-ods-flamingo-cyan motion-reduce:animate-none"
                style={delay}
              />
              <Skeleton className="h-2.5 min-w-0 flex-1 motion-reduce:animate-none" style={delay} />
              <Skeleton className="h-2.5 w-12 shrink-0 motion-reduce:animate-none" style={delay} />
            </div>
          );
        })}
      </div>
      {/* A div, not a paragraph: the typing dots are block elements. */}
      <div className="flex items-center gap-1.5 text-center text-ods-text-secondary text-h4">
        {label}
        <ChatTypingIndicator aria-hidden size="sm" dotClassName="bg-ods-text-secondary motion-reduce:animate-none" />
      </div>
    </div>
  );
}
