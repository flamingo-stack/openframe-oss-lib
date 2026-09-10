/**
 * Build the captions API URL for a video entity.
 *
 * Returns the HTTPS URL to the `/api/captions/[entityType]/[entityId]` endpoint
 * which serves VTT content for iOS native fullscreen subtitles.
 * Returns undefined if entity has no srt_content.
 *
 * Cache-busting hash derived from the srt_content length so iOS Safari
 * fetches fresh VTT when subtitles are regenerated (Safari aggressively caches
 * <track> src URLs even with short Cache-Control max-age).
 *
 * Lifted from hub `lib/utils/captions-url.ts`. The hub's hard-coded
 * `VideoEnabledEntityType` enum is widened to `string` here — embedders
 * pass whatever entity-type discriminator their reverse-proxied
 * `/api/captions/...` route expects.
 */
/** Same-origin default — for hosts that serve the route themselves (the hub).
 *  Cross-origin embedders set `endpoints.captionsUrlPrefix` instead. */
const DEFAULT_CAPTIONS_PATH = '/api/captions';

export function getCaptionsUrl(
  entityType: string,
  entityId: string | number,
  srtContent?: string | null,
  options?: {
    /**
     * Which SRT column the endpoint should serve. `'highlight'` targets the
     * entity's highlight_srt_content (AI highlight reel captions); omitted
     * means the main video's srt_content.
     */
    variant?: 'highlight';
  },
): string | undefined {
  if (!srtContent) return undefined;
  const hash = `${srtContent.length}-${srtContent.slice(0, 8).replace(/\s/g, '')}`;
  const variant = options?.variant ? `&variant=${options.variant}` : '';
  return `${DEFAULT_CAPTIONS_PATH}/${entityType}/${entityId}?v=${hash}${variant}`;
}

/** The slice of `ChatRuntime.endpoints` this module needs. */
export interface CaptionsEndpoints {
  /** Base URL prefix for the captions route (plain path base, no query
   *  params) — e.g. `/content/api/captions` in a proxied embedder. Unset ⇒
   *  the same-origin relative default `/api/captions` (the hub). Wired by
   *  hosts exactly like every other endpoint on `ChatRuntime.endpoints`. */
  captionsUrlPrefix?: string;
}

function resolveCaptionsBase(endpoints?: CaptionsEndpoints | null): string {
  return endpoints?.captionsUrlPrefix || DEFAULT_CAPTIONS_PATH;
}

/** Rebase an already-built relative `/api/captions/...` URL (e.g. one the hub
 *  API computed server-side) onto the host's captions base. Same-origin hosts
 *  (base = default) get the URL back untouched. Non-captions URLs pass through. */
export function rebaseCaptionsUrl<T extends string | null | undefined>(
  endpoints: CaptionsEndpoints | null | undefined,
  url: T,
): T | string {
  if (!url || !url.startsWith(`${DEFAULT_CAPTIONS_PATH}/`)) return url;
  const base = resolveCaptionsBase(endpoints);
  if (base === DEFAULT_CAPTIONS_PATH) return url;
  return `${base}${url.slice(DEFAULT_CAPTIONS_PATH.length)}`;
}

/**
 * The endpoints-aware entry point — `getCaptionsUrl` based on
 * `endpoints.captionsUrlPrefix` (consumers hand over `runtime?.endpoints` and
 * nothing else). Hub/same-origin hosts leave the prefix unset and resolve to
 * the relative default.
 */
export function buildCaptionsUrl(
  endpoints: CaptionsEndpoints | null | undefined,
  entityType: string,
  entityId: string | number,
  srtContent?: string | null,
  options?: { variant?: 'highlight' },
): string | undefined {
  const rel = getCaptionsUrl(entityType, entityId, srtContent, options);
  return rel ? rebaseCaptionsUrl(endpoints, rel) : undefined;
}

/** The two SRT columns every video entity carries — main video + highlight
 *  reel. The caption URL shape is fully generic over these
 *  (`?variant=highlight` is the only difference), so consumers never derive
 *  the two URLs by hand. */
export interface CaptionSrtFields {
  id: string | number;
  srt_content?: string | null;
  highlight_srt_content?: string | null;
}

export interface EntityCaptionUrls {
  captionsUrl?: string;
  highlightCaptionsUrl?: string;
}

/**
 * THE one-stop caption derivation for a video entity: hand over the runtime
 * `endpoints` + the entity row and get both `<track>` URLs back, base-resolved
 * for the host (relative on the hub, proxied in embedders). Every view
 * (release, onboarding guide, webinar, podcast, …) calls this once instead of
 * hand-building main + highlight URLs separately.
 */
export function getEntityCaptionUrls(
  endpoints: CaptionsEndpoints | null | undefined,
  entityType: string,
  entity: CaptionSrtFields | null | undefined,
): EntityCaptionUrls {
  if (!entity) return {};
  return {
    captionsUrl: buildCaptionsUrl(endpoints, entityType, entity.id, entity.srt_content),
    highlightCaptionsUrl: buildCaptionsUrl(endpoints, entityType, entity.id, entity.highlight_srt_content, {
      variant: 'highlight',
    }),
  };
}

/**
 * Identity-only variant of `getEntityCaptionUrls` — for surfaces that know the
 * entity's type + id but NOT its SRT columns (chat cards, whose hydration rows
 * deliberately exclude the heavy SRT content). The `/api/captions` route is
 * addressed purely by `<entityType>/<entityId>`, so the URLs derive from
 * identity alone; a video without subtitles costs one silent 404 `<track>`
 * fetch. No `?v=` cache-buster (no content to hash) — the route's own
 * Cache-Control governs freshness.
 */
export function getEntityCaptionUrlsById(
  endpoints: CaptionsEndpoints | null | undefined,
  entityType: string,
  entityId: string | number,
): Required<EntityCaptionUrls> {
  const base = resolveCaptionsBase(endpoints);
  return {
    captionsUrl: `${base}/${entityType}/${entityId}`,
    highlightCaptionsUrl: `${base}/${entityType}/${entityId}?variant=highlight`,
  };
}

/**
 * Chat docType → captions-route entity type. Chat documentTypes equal the
 * captions entity types for every video-bearing type except podcast
 * (`podcast` vs `podcast_episode`). Kept here (not per-card) so the alias
 * exists exactly once.
 */
export function captionsEntityTypeForDocType(docType: string): string {
  return docType === 'podcast' ? 'podcast_episode' : docType;
}
