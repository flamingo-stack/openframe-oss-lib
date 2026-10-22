import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { SquareAvatar } from '../ui/square-avatar';

export interface ChatTurnProps {
  /** Rendered as given, at the size the caller draws it (a person's picture, an agent's mark). */
  avatar?: ReactNode;
  name: string;
  /** A quieter word after the name ("on her laptop"). */
  meta?: string;
  /** `quiet` steps the name back to the caption size and colour (a turn inside a denser card). */
  nameSize?: 'default' | 'quiet';
  /** Shown as given, at the far end of the name row ("2:47 PM"). */
  time?: string | null;
  /** What was said. A string is drawn as the message text; a node is drawn as given. */
  children?: ReactNode;
  className?: string;
  /** Draw the turn's loading form outside a loading scope too (`useLoadingScope() || loading`). */
  loading?: boolean;
  /**
   * The loading state a loading scope draws, the turn's own skeleton: the picture's size in px (none without it),
   * the message's line count (1 by default) or its own loading form (`body`), and whether a time and a meta are shown.
   */
  skeleton?: Omit<ChatTurnSkeletonProps, 'nameSize' | 'className'>;
}

/** The turn's layout, read by the turn and by its skeleton, so the skeleton is the turn's size. */
export const TURN_ROW_CLASS = 'flex min-w-0 items-start gap-[var(--spacing-system-sf)]';
export const TURN_BODY_CLASS = 'flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]';
const NAME_ROW_CLASS = 'flex min-w-0 items-baseline gap-[var(--spacing-system-xsf)]';
/**
 * The name and its meta: stacked below `content-md` (a phone's card has no room for both on one line, and a cut
 * name or meta says nothing), side by side from `content-md`. The skeleton reads the same class, so it stacks where
 * the turn does.
 */
const NAME_GROUP_CLASS =
  'flex min-w-0 flex-1 flex-col content-md:flex-row content-md:items-baseline content-md:gap-[var(--spacing-system-xsf)]';
const META_CLASS = 'min-w-0 text-ods-text-secondary text-h6 content-md:truncate';
const NAME_TYPE = { default: 'h4', quiet: 'h6' } as const;
const NAME_CLASS = { default: 'text-ods-text-primary text-h4', quiet: 'text-ods-text-secondary text-h6' } as const;
const TIME_CLASS = 'shrink-0 text-ods-text-secondary text-h6';
const MESSAGE_CLASS = 'm-0 whitespace-pre-wrap text-ods-text-primary text-h4';

/**
 * THE turn of a scripted conversation (an example card, a step of a demo): the
 * speaker's picture, then beside it their name, the time at the far end, and
 * what was said under them. Names read as they do everywhere else: the body
 * face, the text colour.
 */
export function ChatTurn({
  avatar,
  name,
  meta,
  nameSize = 'default',
  time,
  children,
  className,
  loading: loadingProp,
  skeleton,
}: ChatTurnProps) {
  const loading = useLoadingScope() || loadingProp;
  if (loading) {
    return (
      <ChatTurnSkeleton
        nameSize={nameSize}
        // `null` says the turn has no time; a placeholder's `''` is a time still to be read.
        time={skeleton?.time ?? time != null}
        meta={skeleton?.meta ?? !!meta}
        lines={skeleton?.lines}
        body={skeleton?.body}
        avatarPx={skeleton?.avatarPx}
        avatarShape={skeleton?.avatarShape}
        className={className}
      />
    );
  }
  return (
    <div className={cn(TURN_ROW_CLASS, className)}>
      {avatar && <span className="shrink-0">{avatar}</span>}
      <div className={TURN_BODY_CLASS}>
        <div className={NAME_ROW_CLASS}>
          <span className={NAME_GROUP_CLASS}>
            <span className={cn('min-w-0 truncate', NAME_CLASS[nameSize])}>{name}</span>
            {meta && <span className={META_CLASS}>{meta}</span>}
          </span>
          {time && <span className={TIME_CLASS}>{time}</span>}
        </div>
        {typeof children === 'string' ? <p className={MESSAGE_CLASS}>{children}</p> : children}
      </div>
    </div>
  );
}

interface ChatTurnSkeletonProps {
  /** The picture's size in px; no picture without it. */
  avatarPx?: number;
  /** The picture's corner, as the caller draws it (a person's round photo by default, a square logo). */
  avatarShape?: 'square' | 'round';
  nameSize?: 'default' | 'quiet';
  /** How many lines the message takes. */
  lines?: 1 | 2 | 3;
  /**
   * The message's own loading form, drawn in place of the line bars (a card whose message is a block of its own:
   * a quote at its line count, an outcome row with its check).
   */
  body?: ReactNode;
  /** Whether the name row carries a time at its far end. */
  time?: boolean;
  /** Whether the name carries a meta line; a string is static copy, drawn for real. */
  meta?: boolean | string;
  className?: string;
}

/**
 * The turn's name row while it is read: a bar at the name's type step, the meta (stacked under it below
 * `content-md`, beside it from there, as the turn draws it) and the time at the far end. Read by the turn's
 * skeleton and by every card that draws a turn of its own.
 */
function ChatTurnNameSkeleton({
  nameSize = 'default',
  meta = false,
  time = false,
}: Pick<ChatTurnSkeletonProps, 'nameSize' | 'meta' | 'time'>) {
  return (
    <div className={NAME_ROW_CLASS}>
      <span className={NAME_GROUP_CLASS}>
        <TextLineSkeleton type={NAME_TYPE[nameSize]} className="w-24" />
        {typeof meta === 'string' ? (
          <span className={META_CLASS}>{meta}</span>
        ) : (
          meta && <TextLineSkeleton type="h6" className="w-20" />
        )}
      </span>
      {time && <TextLineSkeleton type="h6" className="w-12 shrink-0" />}
    </div>
  );
}

/** A turn while it is read: the picture's box, a bar at the name's type step, and a bar per message line. */
function ChatTurnSkeleton({
  avatarPx,
  avatarShape = 'round',
  nameSize = 'default',
  lines = 1,
  body,
  time = false,
  meta = false,
  className,
}: ChatTurnSkeletonProps) {
  return (
    <div className={cn(TURN_ROW_CLASS, className)} aria-hidden>
      {avatarPx ? <SquareAvatar loading sizePx={avatarPx} variant={avatarShape} /> : null}
      <div className={TURN_BODY_CLASS}>
        <ChatTurnNameSkeleton nameSize={nameSize} meta={meta} time={time} />
        {body ?? <TextLineSkeleton lines={lines} type="h4" />}
      </div>
    </div>
  );
}
