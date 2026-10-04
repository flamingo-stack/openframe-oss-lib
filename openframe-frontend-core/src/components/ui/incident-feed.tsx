import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { StatusLine, type StatusLineTone } from './status-line';

/** Where one incident stands. `waiting` is the only state that needs a person. */
export type IncidentStatus = 'working' | 'fixed' | 'waiting' | 'approved';

export interface IncidentStatusLineProps {
  status: IncidentStatus;
  /** The words for this status. The caller owns the copy. */
  label: string;
  className?: string;
}

/**
 * One status, said the same way everywhere: a pulsing dot while work is in
 * flight, the warning colour when a person is needed, a success check once it
 * is done (on its own or after an approval).
 */
const INCIDENT_TONE: Record<IncidentStatus, StatusLineTone> = {
  working: 'working',
  waiting: 'waiting',
  fixed: 'success',
  approved: 'success',
};

export function IncidentStatusLine({ status, label, className }: IncidentStatusLineProps) {
  return <StatusLine tone={INCIDENT_TONE[status]} label={label} className={className} />;
}

export interface IncidentFeedItem {
  id: string;
  /** Where it was found, shown as a tag ("Patch logs"). */
  source: string;
  title: string;
  /** One line under the title of the open item. */
  detail?: string;
  status: IncidentStatus;
  /** A clock label on the collapsed row ("2:14 AM"). */
  time?: string;
  /** A person the incident is about, before the title. */
  avatar?: ReactNode;
}

export interface IncidentFeedProps {
  /** Oldest first. The newest is open; earlier ones collapse to a row. */
  items: readonly IncidentFeedItem[];
  statusLabels: Record<IncidentStatus, string>;
  /** Shown while there is nothing in the feed. */
  emptyLabel?: string;
  /**
   * `top`: the list grows downward (a wide window). `bottom`: the newest item
   * sits at the bottom and older rows fade out at the top (a short card).
   */
  anchor?: 'top' | 'bottom';
  className?: string;
}

function SourceTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 rounded-md border border-ods-border px-2 py-1 text-ods-text-secondary text-h5">
      {children}
    </span>
  );
}

/**
 * A feed of incidents an agent found and handled: the newest one is open
 * (source tag, title, one line of detail, status); the ones before it collapse
 * to a single row each. An item that is waiting on a person stays open even
 * after newer ones arrive, because it is still the thing to look at.
 */
export function IncidentFeed({ items, statusLabels, emptyLabel, anchor = 'top', className }: IncidentFeedProps) {
  const lastIndex = items.length - 1;
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 md:px-5',
        anchor === 'bottom' && 'justify-end [mask-image:linear-gradient(180deg,transparent_0,#000_48px)]',
        className,
      )}
    >
      {items.length === 0 && emptyLabel && <p className="m-auto text-ods-text-secondary text-h4">{emptyLabel}</p>}
      {items.map((item, index) => {
        const open = index === lastIndex || item.status === 'waiting';
        if (!open) {
          return (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-ods-border bg-ods-bg px-3.5 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <SourceTag>{item.source}</SourceTag>
                {item.time && <span className="shrink-0 text-ods-text-secondary text-h6">{item.time}</span>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ods-text-primary text-h4">{item.title}</span>
                <IncidentStatusLine status={item.status} label={statusLabels[item.status]} />
              </div>
            </div>
          );
        }
        return (
          <div
            key={item.id}
            className="flex flex-col gap-1.5 rounded-md border border-ods-border bg-ods-bg px-4 py-3.5 duration-300 animate-in fade-in motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between gap-3">
              <SourceTag>{item.source}</SourceTag>
              {item.time && <span className="shrink-0 text-ods-text-secondary text-h6">{item.time}</span>}
            </div>
            <span className="flex items-start gap-2.5">
              {item.avatar}
              <span className="min-w-0 text-ods-text-primary text-h4">{item.title}</span>
            </span>
            {item.detail && (
              <p
                // Re-keyed on status so the line re-fades when the incident moves on.
                key={item.status}
                className="m-0 text-ods-text-secondary duration-300 animate-in fade-in text-h4 motion-reduce:animate-none"
              >
                {item.detail}
              </p>
            )}
            <IncidentStatusLine status={item.status} label={statusLabels[item.status]} />
          </div>
        );
      })}
    </div>
  );
}
