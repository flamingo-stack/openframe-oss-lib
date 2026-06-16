'use client'

/**
 * `contentFetch` — the fetch the lib's SELF-FETCHING content surfaces use:
 * roadmap (list + vote + per-task refresh), delivery, product releases,
 * onboarding guides (catalog + detail), legal docs, and the release-detail
 * injected roadmap/delivery sections.
 *
 * It deliberately reuses the SINGLE embed-auth knob — the registered
 * `EmbedAuthAdapter` — instead of introducing a second registration:
 *   - adapter registered (host opted into embedded auth, e.g. openframe-frontend
 *     for its embedded chat) → route through `embedAuthedFetch`, so content GETs/
 *     POSTs carry the SAME bearer/cookie + 401-refresh as the chat.
 *   - no adapter (the public hub, or the embedding example whose proxy injects
 *     auth server-side) → a plain, byte-for-byte unchanged `fetch`.
 *
 * So a host wires auth ONCE (the chat adapter) and content inherits it; there is
 * no content-specific fetcher to configure.
 */

import { embedAuthedFetch, hasEmbedAuthAdapter } from './embed-authed-fetch'

export const contentFetch: typeof fetch = (input, init) => {
  if (!hasEmbedAuthAdapter()) return fetch(input, init)
  // embedAuthedFetch takes a string url; coerce the broader `fetch` input shape
  // (content surfaces always pass strings, but handle URL/Request defensively).
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  return embedAuthedFetch(url, init)
}
