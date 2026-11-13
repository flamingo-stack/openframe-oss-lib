/**
 * The error envelope every hub route answers (`{ error, code }`), read for the end user.
 *
 * Server-safe: no React, no browser APIs.
 */

/**
 * Pull the user-facing copy out of a failed response.
 *
 * `error` is written for the end user, so it beats any status-code copy the client could invent. Returns null when the
 * body is not that envelope (HTML error page, empty body, gateway response): the caller then supplies its own generic line.
 *
 * Consumes the body: call it once, on a response you have already decided is a failure.
 */
export async function readServerErrorMessage(response: { json: () => Promise<unknown> }): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown } | null;
    if (typeof body?.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    /* non-JSON error body: the caller falls through to its generic copy */
  }
  return null;
}
