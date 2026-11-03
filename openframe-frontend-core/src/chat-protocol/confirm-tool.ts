/**
 * The old approval route's request, and the error envelope every hub route answers.
 *
 * `readServerErrorMessage` stays: a failed answer's `error` is written for the end user. The rest is
 * TODO(CU-17tkuw635xx): an approval on the UI stream is a chat request (`approval-responded` parts), and only a hub that
 * still answers old frames takes this body. It goes at the cleanup.
 *
 * Server-safe: no React, no browser APIs.
 */

/** What the user did with the card. */
export type ApprovalToolAction = 'approve' | 'reject';

/** Client-side shape of a confirm; `buildConfirmToolBody` renames it to the
 *  wire's own casing so no caller hand-writes `proposal_id`. */
export interface ConfirmToolRequest {
  /** The hub-minted proposal id carried by the card. */
  proposalId: string;
  action: ApprovalToolAction;
  /**
   * The hub's conversation id, quoted back verbatim. The hub rejects a confirm
   * without it: a proposal only means something inside the conversation that
   * minted it.
   */
  conversationId: string | null | undefined;
}

/** Build the confirm-tool request body. The ONE place that knows the wire
 *  spells the id `proposal_id` while everything else is camelCase. */
export function buildConfirmToolBody(request: ConfirmToolRequest): Record<string, unknown> {
  return {
    proposal_id: request.proposalId,
    action: request.action,
    conversationId: request.conversationId,
  };
}

/**
 * Pull the user-facing copy out of a failed chat/confirm response.
 *
 * The route-base envelope is `{error, code}`; `error` is written for the end
 * user, so it beats any status-code copy the client could invent. Returns null
 * when the body is not that envelope (HTML error page, empty body, gateway
 * response) — the caller then supplies its own generic line.
 *
 * Consumes the body: call it once, on a response you have already decided is a
 * failure.
 */
export async function readServerErrorMessage(response: { json: () => Promise<unknown> }): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown } | null;
    if (typeof body?.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    /* non-JSON error body — the caller falls through to its generic copy */
  }
  return null;
}
