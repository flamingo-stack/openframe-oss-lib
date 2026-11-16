/**
 * What a record's card or chip draws: the record a URI names (`chat-protocol/record-link`), and what is known about it
 * before its row arrives. The title and url come from the message's own source part with the same URI, else the link's
 * label.
 *
 * The OSS-lib has NO knowledge of which entity types exist or how to render them: the host (consumer of this library)
 * supplies a renderer via `<ChatMessageEnhanced renderEntityCard={...} />`.
 */
export interface ChatRef {
  /** documentType from the host's RAG config (e.g. 'webinar', 'customer_interview').
   *  Treated as opaque by the OSS-lib — the host owns the type vocabulary. */
  type: string;
  /** RagTableConfig.id, when a row knows it: drives the icon + label lookup. Derived, in memory only: no wire carries it. */
  sourceRepo?: string;
  /** Primary-key value. Opaque string downstream. */
  id: string;
  /** Display title — used for fallback rendering when the host's renderer
   *  returns null (e.g. unknown type). */
  title: string;
  /** Resolved external URL — null when the entity has no public link. */
  url: string | null;
  /** The platform that owns `url`, as the host's composer answered it. Derived, in memory only: no wire carries it. */
  targetPlatform?: string | null;
  /** A ClickUp task's own address, as its row answers it. In memory only: what the record's menu links to, never composed. */
  clickupUrl?: string | null;
  /** ISO date for the entity's canonical time. Optional. */
  date?: string;
  /** PII-sanitized hover preview text. Optional. */
  preview?: string;
  /** Type-specific extras, a keyed map the host's renderer can pull from. */
  metadata?: Record<string, unknown>;
}
