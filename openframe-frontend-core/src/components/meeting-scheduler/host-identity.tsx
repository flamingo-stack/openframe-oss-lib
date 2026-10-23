'use client';

import type { MeetingHost } from '../../schemas/meeting-booking-schema';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { AvatarStack, SquareAvatar } from '../ui';
import { useLoadingScope } from '../ui/loading-scope';

/** The host list, one host's row and its text column, read by the identity and by its skeleton. */
const HOST_LIST_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-s)]';
const HOST_ROW_CLASS = 'flex items-center gap-[var(--spacing-system-xs)]';
const HOST_TEXT_CLASS = 'flex min-w-0 flex-col';
/** A large team (more than {@link MAX_HOST_ROWS} hosts): the stacked avatars over the count. */
const HOST_TEAM_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-xs)]';
/** Hosts drawn as full rows; a larger team (round-robin links can carry many) collapses to a stack and a count. */
const MAX_HOST_ROWS = 3;

/**
 * Who the meeting is with: full rows (avatar, name, title) up to three hosts, a stacked-avatar cluster and a count for
 * a larger team, so neither the modal's strip nor the context panel can overflow. ONE switch: in a loading scope, or
 * while the meeting is read (`loading`), it is its own {@link HostIdentitySkeleton}. Read by the modal header and the
 * context panel.
 */
export function HostIdentity({ hosts, loading = false }: { hosts: MeetingHost[]; loading?: boolean }) {
  if (useLoadingScope() || loading) return <HostIdentitySkeleton />;
  if (hosts.length === 0) return null;
  if (hosts.length > MAX_HOST_ROWS) {
    return (
      <div className={HOST_TEAM_CLASS}>
        <AvatarStack people={hosts} max={4} size="lg" label="Hosts" />
        <p className="text-ods-text-secondary text-h6">{hosts.length} hosts on this calendar</p>
      </div>
    );
  }
  return (
    <div className={HOST_LIST_CLASS}>
      {hosts.map(host => (
        <div key={host.name} className={HOST_ROW_CLASS} data-loading-item>
          <SquareAvatar
            variant="round"
            size="sm"
            src={host.avatarUrl ?? undefined}
            alt={host.name}
            fallback={host.name}
          />
          <div className={HOST_TEXT_CLASS}>
            <p className="truncate text-ods-text-primary text-h4">{host.name}</p>
            {host.title && <p className="truncate text-ods-text-secondary text-h6">{host.title}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The identity while the meeting is read: one host's row (a typical link has one host), its name and title as bars. */
function HostIdentitySkeleton() {
  return (
    <div className={HOST_LIST_CLASS}>
      <div className={HOST_ROW_CLASS} data-loading-item>
        <SquareAvatar loading variant="round" size="sm" />
        <div className={HOST_TEXT_CLASS}>
          <TextLineSkeleton type="h4" className="w-32" />
          <TextLineSkeleton type="h6" className="w-24" />
        </div>
      </div>
    </div>
  );
}
