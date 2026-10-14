'use client';

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
