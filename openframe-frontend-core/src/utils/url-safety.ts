/**
 * URL-safety primitives for the wire DECODER and the render-time guard.
 *
 * `UNSAFE_URL_CHARS` is shared by both: "does this string carry characters that
 * have no business in an href" had two copies once, and a security predicate
 * kept in sync by a comment drifts.
 *
 * `isSameOriginPath` answers "does this path stay on our origin" for the
 * render-time `safeHref` — the ONE gate every chat href passes. The wire decoder
 * does not judge links at all: it carries them, because resolving a link is a
 * client decision (only the rendering page knows where it is embedded), and a
 * second, stricter gate there only dropped links it could not resolve itself.
 *
 * Pure and dependency-free, so the server-safe `chat-protocol` leaf and the
 * client-side card utils can both import it directly.
 */

/** Control, zero-width and line-separator characters. Never legitimate in a URL
 *  we are about to render, and the classic way a payload smuggles one href past
 *  a reader's eye. */
export const UNSAFE_URL_CHARS = /[\u0000-\u001f\u007f\u200b-\u200d\u2028\u2029\ufeff]/;

/** Opaque base used only to ask the parser which origin a path lands on. */
const SAME_ORIGIN_PROBE = 'https://_sameorigin_.invalid';

/**
 * Does this candidate stay on the CURRENT origin?
 *
 * Decided by RESOLVING it, never by inspecting the prefix. A prefix test is
 * what a reader reaches for — `startsWith('//')` — and it is not sufficient:
 * the URL parser treats a backslash as a slash in the authority position, so a
 * single-slash path can still resolve to a third-party host while passing every
 * "starts with exactly one slash" check. Any future parser quirk falls to the
 * same class. Asking the parser cannot disagree with what the browser will
 * actually do with the href.
 */
export function isSameOriginPath(candidate: string): boolean {
  try {
    return new URL(candidate, SAME_ORIGIN_PROBE).origin === SAME_ORIGIN_PROBE;
  } catch {
    return false;
  }
}
