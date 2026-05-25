/**
 * HubSpot Ticket entity — wire shape for the chat hubspot-ticket card.
 *
 * Lifted from `components/shared/hubspot/hubspot-ticket-card.tsx`. The
 * card consumes this shape across THREE variants — FULL (all fields,
 * for admin/internal viewers), ANON (no customerCompany, no url), and
 * SELF (the chat user's own tickets, no admin URL). The shape itself
 * is the same; the indexer redacts the variant-restricted fields to
 * null before sending the row to the client.
 */

export interface HubspotTicketItem {
  /** HubSpot ticket id (the `external_id` column on hubspot_tickets) */
  id: string;
  /** Subject — ticket title */
  title: string;
  /** Body preview (sanitized via the mapper's `buildPreview`) */
  preview?: string;
  /** Canonical status (NEW | IN_PROGRESS | WAITING | CLOSED) — drives
   *  badge color + sort order. */
  status?: string | null;
  /** Human-readable HubSpot pipeline stage label (e.g. "Code review",
   *  "Closed"). Drives badge TEXT. Falls back to the formatted canonical
   *  `status` when null (rows synced before the column landed). */
  statusLabel?: string | null;
  /** Severity: LOW | MEDIUM | HIGH | URGENT */
  priority?: string | null;
  /** Customer company (FULL variant only — anon strips this) */
  customerCompany?: string | null;
  /** Customer email — usually the chat-creating user's address. Shown as
   *  a discrete row so customers can confirm who the ticket is for
   *  (especially relevant in proxy-auth surfaces where the chat user
   *  acts on behalf of another email). */
  customerEmail?: string | null;
  /** ISO timestamp or epoch */
  dateUpdated?: string | number | null;
  /** HubSpot UI URL (FULL variant only; null for anon + self) */
  url?: string | null;
}
