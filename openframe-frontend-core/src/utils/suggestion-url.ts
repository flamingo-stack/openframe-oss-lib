/**
 * Shared fetch-URL composer for the two suggestion sections (FaqSection +
 * RelatedContentSection) — ONE owner of the entityType/entityId/count query
 * shape so the sections can never drift. Pure + server-safe.
 *
 * Byte-parity contract with the original `buildFaqsUrl`: when only
 * entityType/entityId are set, the param order is `entityType`, `entityId`;
 * with nothing set, the bare `path` is returned (no `?`).
 */
export interface SuggestionUrlOptions {
  /** Fetch-URL prefix for third-party embeds / reverse proxies
   *  ('' = same-origin relative). */
  apiBaseUrl?: string
  /** Both required together for entity scope; partial → bare path. */
  entityType?: string
  entityId?: number | string
  /** Maps to the server's `count` param. Undefined → param not sent
   *  (server default applies). */
  count?: number
  /** Extra query params appended after the shared trio (e.g. the
   *  related-content `excludeTypes` deny-list). Empty/undefined values
   *  are skipped. */
  extraParams?: Record<string, string | undefined>
}

export function buildSuggestionUrl(path: string, opts: SuggestionUrlOptions = {}): string {
  const qs = new URLSearchParams()
  const { entityType, entityId } = opts
  if (entityType && entityId !== undefined && entityId !== null && entityId !== '') {
    qs.set('entityType', entityType)
    qs.set('entityId', String(entityId))
  }
  if (opts.count !== undefined) qs.set('count', String(opts.count))
  for (const [key, value] of Object.entries(opts.extraParams ?? {})) {
    if (value !== undefined && value !== '') qs.set(key, value)
  }
  const query = qs.toString()
  return `${opts.apiBaseUrl ?? ''}${path}${query ? `?${query}` : ''}`
}
