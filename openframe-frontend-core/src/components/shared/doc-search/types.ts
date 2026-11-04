/**
 * One row of `/api/docs/search`, as the lib reads it. A record's identity is its record URI, and what can be derived from
 * the URI (its type, its id, its table) or the url (its platform) is not carried. The hub's server-side RAG layer
 * composes the row; `docSearchFieldsOf` (`chat-protocol/message-decoder`) reads it.
 */
export interface DocSearchResult {
  /** The record URI. Null for a row the server could not name (no primary key or no type). */
  sourceId: string | null;
  title: string;
  /** Where the record opens, absolute. Absent for a row with no page: a click asks the chat about it instead. */
  url?: string;
  type: 'file' | 'folder';
  snippet: string;
  matchType: 'title' | 'content';
}
