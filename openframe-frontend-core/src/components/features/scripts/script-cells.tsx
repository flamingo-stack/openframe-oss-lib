'use client';

import { DataTableCell } from '../../ui/data-table/data-table-cell';
import { TruncateText } from '../../ui/truncate-text';

/** A name over its description: the first column of both Scripts tables. */
export function ScriptNameCell({ name, description }: { name: string; description?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <TruncateText>{name}</TruncateText>
      {description && (
        <TruncateText variant="h6" tone="secondary">
          {description}
        </TruncateText>
      )}
    </div>
  );
}

/** When a schedule starts: the date over the time (and whose clock the time is read on). */
export function ScheduleDateTimeCell({ date, time }: { date: string; time: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <TruncateText>{date}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {time}
      </TruncateText>
    </div>
  );
}

/*
 * The same cells in the grid layout: one 48px line each, the second line as the secondary text beside the first.
 * A row still being read (a host's placeholder row in a loading scope) has no field yet: the main text is then empty,
 * never absent, so the cell draws its bar.
 */

/** A name with its description beside it. */
export function ScriptNameGridCell({ name, description }: { name: string; description?: string | null }) {
  return <DataTableCell text={name || ''} secondary={description || undefined} />;
}

/** When a schedule starts: the date with the time beside it. */
export function ScheduleDateTimeGridCell({ date, time }: { date: string; time: string }) {
  return <DataTableCell text={date || ''} secondary={time || undefined} />;
}
