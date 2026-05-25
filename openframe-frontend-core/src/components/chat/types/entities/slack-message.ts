/**
 * Slack Message entity — wire shape for the chat slack-message card.
 *
 * Lifted from `components/shared/slack/slack-message-card.tsx`. The card
 * consumes this shape; the row shape coming out of the `slack_messages`
 * RAG table is reduced to this minimal projection at render time.
 *
 * Naming note: this is intentionally `SlackMessageItem` (not the broader
 * `SlackMessage` in `src/types/slack.ts`, which describes the Slack
 * Community feature's message structure including reactions / threading /
 * user objects). The chat card needs only the post-RAG projection: id,
 * title, preview, channel, date, permalink — no reactions / threads.
 */

export interface SlackMessageItem {
  /** Slack message ID (ts or url-derived) */
  id: string;
  /** Display title — typically "author · channel" or message subject */
  title: string;
  /** Message body preview (PII-sanitized server-side) */
  preview?: string;
  /** Channel name parsed from URL or stored on the row, when available */
  channel?: string;
  /** ISO timestamp or millisecond epoch */
  dateUpdated?: string | number | null;
  /** Slack permalink (https://*.slack.com/archives/<channel>/p<ts>) */
  url?: string | null;
}
