/**
 * The hub's confirm-tool contract — request shape and error envelope.
 *
 * Resolving a Product Guide proposal is a POST to `endpoints.approvalToolUrl`
 * whose response is an ordinary guide stream (a `decision_resolved` frame, then
 * the hub's auto-continuation). Two callers make that call today: the SSE chat
 * adapter, and any host replaying the same route into a different transport's
 * conversation (the product app resolves guide cards inside a NATS Mingo
 * dialog). They MUST send byte-identical bodies — a proposal is single-use, so a
 * caller that drifts on a field name does not degrade, it fails the write — and
 * they must surface the same server copy, because the hub's errors are written
 * for the end user ("This approval expired — ask again to get a fresh one").
 *
 * Hence both live here rather than at either call site.
 *
 * Server-safe: no React, no browser APIs.
 */

/** What the user did with the card. */
export type ApprovalToolAction = 'approve' | 'reject'

/** Client-side shape of a confirm; `buildConfirmToolBody` renames it to the
 *  wire's own casing so no caller hand-writes `proposal_id`. */
export interface ConfirmToolRequest {
  /** The hub-minted proposal id carried by the card. */
  proposalId: string
  action: ApprovalToolAction
  /**
   * The hub's conversation id, quoted back verbatim. The hub rejects a confirm
   * without it: a proposal only means something inside the conversation that
   * minted it.
   */
  conversationId: string | null | undefined
}

/** Build the confirm-tool request body. The ONE place that knows the wire
 *  spells the id `proposal_id` while everything else is camelCase. */
export function buildConfirmToolBody(request: ConfirmToolRequest): Record<string, unknown> {
  return {
    proposal_id: request.proposalId,
    action: request.action,
    conversationId: request.conversationId,
  }
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
export async function readServerErrorMessage(response: {
  json: () => Promise<unknown>
}): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown } | null
    if (typeof body?.error === 'string' && body.error.length > 0) return body.error
  } catch {
    /* non-JSON error body — the caller falls through to its generic copy */
  }
  return null
}
