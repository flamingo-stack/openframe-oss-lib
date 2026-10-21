'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { AgentMark } from '../../agent-mark';
import { MonitorIcon } from '../../icons-v2-generated/devices/monitor-icon';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { scriptExecutionStatus } from './execution-status';

/**
 * The cells of the Execution History (Figma 155:38356) and the Result block
 * of an execution's page. Each takes display values: the product maps its
 * Relay records into them and keeps what only it has (links to an employee
 * page, the deleted-user avatar) as slots.
 */

/** How an execution was dispatched, as the chip beside the person it ran for. */
export function ExecutionSourceBadge({ source, className }: { source: string | null | undefined; className?: string }) {
  // A `span`: the chip sits inside a line of text. It never shrinks; the name beside it ellipsizes.
  // Labels are sentence case here; the Tag's h5 type scale uppercases them.
  const tagProps = { as: 'span', variant: 'outline', className: cn('shrink-0', className) } as const;

  if (source === 'SCHEDULED') return <Tag {...tagProps} label="Scheduled" />;
  if (source === 'AI_ASSISTANT') {
    // Mingo's own mark, the way the product stamps it everywhere else.
    return <Tag {...tagProps} label="Mingo" icon={<AgentMark agent="mingo" className="size-4" />} />;
  }
  // MANUAL draws nothing: the person is the technician who clicked Run, so a chip would restate the name.
  return null;
}

/**
 * The Execution column: when it was dispatched over its id. The date filter
 * sits on this column's header because its first line is that date.
 */
export function ExecutionTimestampCell({ timestamp, executionId }: { timestamp: string; executionId: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <TruncateText>{timestamp}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {executionId}
      </TruncateText>
    </div>
  );
}

/** A status as its tag; the flex row keeps the tag at its own width in a stretch column. */
export function ExecutionStatusCell({ status }: { status: string | null | undefined }) {
  const presentation = scriptExecutionStatus(status);
  return (
    <div className="flex">
      <Tag label={presentation?.label ?? String(status ?? '')} variant={presentation?.variant ?? 'grey'} />
    </div>
  );
}

/**
 * The device an execution ran on, with its customer under it. The icon rides
 * with the name only; the customer line starts under the icon, as the design
 * has it. `name` is a node so a host can draw its own empty mark.
 */
export function ExecutionDeviceCell({ name, organization }: { name: ReactNode; organization?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <MonitorIcon className="size-6 shrink-0 text-ods-text-secondary" />
        {/* So the name shrinks and ellipsizes next to the icon. */}
        <div className="min-w-0 flex-1">{typeof name === 'string' ? <TruncateText>{name}</TruncateText> : name}</div>
      </div>
      {organization && (
        <TruncateText variant="h6" tone="secondary">
          {organization}
        </TruncateText>
      )}
    </div>
  );
}

/**
 * Who an execution ran for, with the chip of what dispatched it: a schedule or
 * Mingo runs on a technician's behalf, so the chip qualifies the name instead
 * of standing in for it. The script's name is the second line where a list
 * runs several scripts (a schedule's); a script's own list leaves it out.
 * The avatar and the name are slots: the product links the name to the
 * person's page and draws a deleted account its own way.
 */
export function ExecutionInitiatorCell({
  avatar,
  name,
  source,
  scriptName,
}: {
  avatar: ReactNode;
  name: ReactNode;
  source?: string | null;
  scriptName?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          {typeof name === 'string' ? <TruncateText>{name}</TruncateText> : name}
          <ExecutionSourceBadge source={source} />
        </div>
        {scriptName && (
          <TruncateText variant="h6" tone="secondary">
            {scriptName}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The Result column: the first two lines of what the run printed, or the host's empty mark. */
export function ExecutionResultCell({ result, empty = null }: { result?: string | null; empty?: ReactNode }) {
  return result ? <TruncateText lines={2}>{result}</TruncateText> : <>{empty}</>;
}

/**
 * What an execution printed, as its page shows it: the whole output with its
 * line breaks, labelled "Result". A run still in flight with nothing printed
 * yet says so (its page polls, so the output streams in) instead of a dead
 * end; a finished run with no output shows the host's empty mark.
 */
export function ScriptExecutionResult({
  result,
  inFlight = false,
  empty,
  loading: loadingProp = false,
  className,
}: {
  result?: string | null;
  inFlight?: boolean;
  empty: ReactNode;
  /** The execution is still being read: the output is one `text-h4` line, the "Result" caption real. A loading
   *  scope does the same. */
  loading?: boolean;
  className?: string;
}) {
  // ONE switch: while the execution is read the output line is its skeleton; the caption is copy.
  const loading = useLoadingScope() || loadingProp;
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-m)]', className)}>
      {loading ? (
        <TextLineSkeleton type="h4" className="w-3/4 max-w-full" />
      ) : result ? (
        <div className="whitespace-pre-wrap break-words text-ods-text-primary text-h4">{result}</div>
      ) : (
        <div className="text-ods-text-secondary text-h4">{inFlight ? 'Waiting for output…' : empty}</div>
      )}
      <div className="text-ods-text-secondary text-h6">Result</div>
    </div>
  );
}
