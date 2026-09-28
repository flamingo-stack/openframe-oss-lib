'use client';

/**
 * TicketAlertsButton — the unified header affordance for support-ticket
 * unread indication. Mounted by BOTH header shells (hub `Header` via
 * `HeaderConfig.tickets`, console `AppHeader` via `showTicketAlerts`).
 *
 * ATTENTION-ONLY element, deliberately unlike the always-on header cells:
 *   - renders NOTHING unless there are unread support replies (and a
 *     `TicketLiveProvider` is mounted and the viewer is signed in) —
 *     appearing IS the indication, and it disappears once everything
 *     is read;
 *   - standard header-cell glyph coloring (matches the notifications /
 *     time-tracker cells) + accent count pill (2 updates → "2", the
 *     sidebar count-pill treatment);
 *   - clicking routes to the ticket with the NEWEST unread reply via the
 *     SSOT deep link (`buildTicketOpenHref` → `<href>?ticket=<id>`): the
 *     `?ticket=` param is the ONE open-drawer source of truth in
 *     `HelpCenterList`, and opening the drawer already smooth-scrolls
 *     the row. With multiple updates the pill stays up with the
 *     remaining count and the next click routes to the next-newest
 *     unread ticket.
 *
 * Design note: the console's NATS-backed `NotificationsProvider` bell
 * covers OpenFrame-internal events; Help Center replies come from the
 * HubSpot mirror domain and must ALSO surface on the hub, which mounts
 * no notifications system — so the affordance both hosts can share is
 * this dedicated cell, not the bell.
 */

import { cn } from '../../utils/cn';
import { LifeBuoyIcon } from '../icons-v2-generated/interface/life-buoy-icon';
import { useOptionalTicketLive } from '../tickets/ticket-live-provider';
import { buildTicketOpenHref } from '../tickets/types';
import { HeaderButton } from './header-button';
import { UnreadCountBadge } from './unread-dot';

export interface TicketAlertsButtonProps {
  /** BASE path of the host's tickets surface — may carry ANY nesting
   *  prefix (hub `/tickets`, console `/help-center/tickets`, an
   *  embedder's `/support/portal/tickets`). The deep link is built by
   *  the SSOT `buildTicketOpenHref` (`<base>?ticket=<id>` — the same
   *  param `HelpCenterList` derives its drawer state from; opening the
   *  drawer also smooth-scrolls the row). */
  href: string;
  /** Host navigation (router push) — receives the FULL computed href.
   *  Defaults to `window.location.assign`. */
  onNavigate?: (href: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TicketAlertsButton({ href, onNavigate, disabled, className }: TicketAlertsButtonProps) {
  const live = useOptionalTicketLive();
  // Attention-only: no provider, signed out, or nothing unread → no cell.
  if (!live || !live.authed || live.unreadTotal === 0) return null;

  const targetId = live.nextUnreadTicketId;
  const target = targetId ? buildTicketOpenHref(href, targetId) : href;

  const handleClick = () => {
    if (onNavigate) onNavigate(target);
    else window.location.assign(target);
  };

  return (
    <HeaderButton
      icon={
        // Glyph inherits HeaderButton's standard cell coloring (secondary at
        // rest, primary on active) — SAME treatment as the notifications
        // bell and time-tracker cells. The indication is carried by the
        // count pill (sidebar count-pill precedent) and by the cell only
        // existing while updates are unread — never by tinting the glyph.
        <span className="relative inline-flex">
          <LifeBuoyIcon className="h-6 w-6" />
          <UnreadCountBadge count={live.unreadTotal} />
        </span>
      }
      aria-label={`Support tickets — ${live.unreadTotal} unread ${live.unreadTotal === 1 ? 'update' : 'updates'}`}
      onClick={handleClick}
      disabled={disabled}
      className={cn(className)}
    />
  );
}

export default TicketAlertsButton;
