'use client';

import { personFirstName } from '../../utils/format';
import { AvatarStack } from './avatar-stack';
import { Button } from './button';
import { FloatingTooltip } from './floating-tooltip';
import { SquareAvatar } from './square-avatar';
import { TruncateText } from './truncate-text';

/**
 * THE person cells for tables and dense lists — one for a single person, one
 * for a column that may hold several — so every column of people in every app
 * reads the same way.
 *
 *   - `PersonCell`  → avatar, name, then a second line (a title, an email)
 *   - `PeopleCell`  → zero or one person IS `PersonCell`; several become an
 *                     `AvatarStack` in a FIXED two-position slot beside their
 *                     first names ("Dmytro & Michael & Ilona") across both
 *                     lines. A title per person does not fit, and the names are
 *                     what the column is read for; the tooltip carries the full
 *                     names. The fixed slot keeps every multi-person row's names
 *                     on the same x, whether it holds two people or twelve.
 */

export interface PersonCellProps {
  name?: string | null;
  avatarUrl?: string | null;
  /**
   * The second line: a job title, an email, a department. Omitted keeps the
   * two-line height with an empty line; `null` or `''` (a value that is
   * expected but missing) renders a `·` placeholder.
   */
  secondary?: string | null;
  /** Shown when there is no name — "Unassigned", "Unknown", … */
  fallbackName?: string;
  /** Makes the whole cell a button and the name an accent link (e.g. filter by this person). */
  onClick?: () => void;
  /** Tooltip for the clickable cell ("Filter by ada@example.com"). */
  actionTitle?: string;
}

export function PersonCell({
  name,
  avatarUrl,
  secondary,
  fallbackName = 'Unassigned',
  onClick,
  actionTitle,
}: PersonCellProps) {
  const displayName = name || fallbackName;
  const row = (
    <div className="group/person-cell flex min-w-0 items-center gap-3">
      <SquareAvatar size="sm" src={avatarUrl ?? undefined} alt={displayName} fallback={displayName} />
      <div className="min-w-0 flex-1">
        <TruncateText
          variant="h6"
          className={onClick ? 'text-ods-accent group-hover/person-cell:underline' : undefined}
        >
          {displayName}
        </TruncateText>
        <TruncateText variant="h6" tone="secondary">
          {secondary === undefined ? ' ' : secondary || '·'}
        </TruncateText>
      </div>
    </div>
  );
  if (!onClick) return row;
  return (
    <Button
      variant="transparent"
      onClick={onClick}
      title={actionTitle}
      // No hover background — only the name underlines. `text-left`: a button
      // centers its text by default, which would center the second line.
      className="h-auto w-full min-w-0 cursor-pointer justify-start bg-transparent p-0 text-left hover:bg-transparent focus:bg-transparent"
    >
      {row}
    </Button>
  );
}

export interface PeopleCellPerson {
  /** Stable render key (a profile id) — names can collide or be blank. */
  key?: string | number;
  name?: string | null;
  avatarUrl?: string | null;
  /** The single-person second line — see `PersonCellProps.secondary`. */
  secondary?: string | null;
}

export interface PeopleCellProps {
  people: PeopleCellPerson[];
  /** Shown when the list is empty — the same slot `PersonCell` fills. */
  fallbackName?: string;
}

/** Positions the multi-person stack reserves: two faces, or one face and "+N". */
const PEOPLE_CELL_STACK_SLOTS = 2;

export function PeopleCell({ people, fallbackName = 'Unassigned' }: PeopleCellProps) {
  if (people.length <= 1) {
    const [person] = people;
    return (
      <PersonCell
        name={person?.name}
        avatarUrl={person?.avatarUrl}
        secondary={person ? person.secondary : undefined}
        fallbackName={fallbackName}
      />
    );
  }
  const fullNames = people.map(p => p.name || 'Unknown').join(', ');
  return (
    <FloatingTooltip content={fullNames} triggerClassName="min-w-0 max-w-full">
      {/* Same gap and two-line height as `PersonCell`, so the two sit on one rhythm. */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Decorative here: the names are the text right beside it, so the
            stack's own accessible name would read every name twice. */}
        <div aria-hidden className="shrink-0">
          <AvatarStack
            size="sm"
            slots={PEOPLE_CELL_STACK_SLOTS}
            people={people.map(p => ({ key: p.key, name: p.name || 'Unknown', avatarUrl: p.avatarUrl }))}
          />
        </div>
        <p className="line-clamp-2 min-w-0 flex-1 break-words text-ods-text-primary text-h6">
          <span aria-hidden>{people.map(p => personFirstName(p.name, 'Unknown')).join(' & ')}</span>
          <span className="sr-only">{fullNames}</span>
        </p>
      </div>
    </FloatingTooltip>
  );
}
