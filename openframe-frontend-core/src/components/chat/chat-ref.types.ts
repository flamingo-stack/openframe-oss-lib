/**
 * Wire schema for an inline entity reference emitted by the chat backend.
 *
 * Mirrors `ChatRef` in `lib/data/doc-chat-utils.ts` on the multi-platform-hub
 * server. The OSS-lib has NO knowledge of which entity types exist or how to
 * render them — the host (consumer of this library) supplies a renderer via
 * `<ChatMessageEnhanced renderEntityCard={...} />`. v6.1 §B.2.6+§B.2.7.
 *
 * The metadata frame on the wire carries `refs: Record<\`<type>:<id>\`, ChatRef>`,
 * and `[card://<type>:<id>]` markers inside the assistant body expand into
 * whatever JSX the host returns.
 */
export interface ChatRef {
  /** documentType from the host's RAG config (e.g. 'webinar', 'customer_interview').
   *  Treated as opaque by the OSS-lib — the host owns the type vocabulary. */
  type: string
  /** Primary-key value. Opaque string downstream. */
  id: string
  /** Display title — used for fallback rendering when the host's renderer
   *  returns null (e.g. unknown type). */
  title: string
  /** Resolved external URL — null when the entity has no public link. */
  url: string | null
  /** ISO date for the entity's canonical time. Optional. */
  date?: string
  /** PII-sanitized hover preview text. Optional. */
  preview?: string
  /** Type-specific extras carried opaquely through the wire — keyed map
   *  the host's renderer can pull from. Used today by `slack_message`
   *  refs to ship `{ channelName, userName }` resolved server-side from
   *  the slack-channels / slack-users tables, so the compact card
   *  surfaces human-readable names instead of opaque Slack IDs. */
  metadata?: Record<string, unknown>
}
