/**
 * Shared cross-process contract for the post-approval auto-continuation
 * directive. The client emits a hidden synthetic user message starting
 * with `AUTO_CONTINUATION_DIRECTIVE_PREFIX`; the server's `decideRoute`
 * matches that exact prefix on the RAW user query (pre-rewriter) and
 * hard-disables tools for the directive turn, forcing the LLM to
 * respond with prose follow-up questions instead of duplicating the
 * just-approved tool call.
 *
 * Single source of truth — both server-side `decideRoute` AND
 * client-side `autoContinueRef` import from here. Drifting the literal
 * on either side would silently break the duplicate-ticket guard
 * (server would route normally with tools wired; LLM would propose the
 * same tool again).
 *
 * `toolName` is typed as `string` (not a const-union) so the lib stays
 * generic across hub deployments — host code that has a sharper
 * `KnownWriteToolName` type can pass that through; this builder only
 * cares about a handful of string-equal branches.
 */

export const AUTO_CONTINUATION_DIRECTIVE_PREFIX = '[internal-auto-continuation]'

export interface BuildAutoContinuationOptions {
  ticketId?: string
  /** Reading of `args.status` on the just-approved tool call. Used to
   *  branch the directive between "post-create diagnostic Qs",
   *  "post-close resolution ask", and "post-update acknowledgement". */
  status?: string
}

/**
 * Build the directive text the client sends as a HIDDEN user message
 * after every successful Approve. The LLM treats it as the user
 * speaking; the chat shell filters it out at render time.
 *
 * Branch logic mirrors `TICKET_TOOL_PROTOCOL` §1a/§1b — keep them in
 * sync: the directive tells the model WHICH section to follow.
 */
export function buildAutoContinuationDirective(
  toolName: string,
  opts: BuildAutoContinuationOptions = {},
): string {
  const ticketRef = opts.ticketId ? ` (ticket #${opts.ticketId})` : ''
  const ticketHash = opts.ticketId ? ` #${opts.ticketId}` : ''
  const isClose = toolName === 'update_ticket' && opts.status?.toUpperCase() === 'CLOSED'
  if (toolName === 'create_ticket') {
    return (
      `${AUTO_CONTINUATION_DIRECTIVE_PREFIX} The user just approved create_ticket${ticketRef}. ` +
      `Per ticket-protocol §1a, ask 2-4 SHORT, issue-specific diagnostic follow-up questions ` +
      `tailored to the symptom they reported in their original message. When they answer, ` +
      `propose an update_ticket with content_addendum carrying a clean Q&A digest. ` +
      `Do NOT call any tool in this turn — just write the questions as prose.`
    )
  }
  if (isClose) {
    return (
      `${AUTO_CONTINUATION_DIRECTIVE_PREFIX} The user just approved closing ticket${ticketHash}. ` +
      `Per ticket-protocol §1b, ask ONE short question: "How was this resolved? I'll add it ` +
      `to the ticket as a closing note." Phrase kindly even if the user was curt. When they ` +
      `answer, propose an update_ticket with content_addendum="[Resolution] <their words>". ` +
      `Do NOT call any tool in this turn — just write the prose ask.`
    )
  }
  return (
    `${AUTO_CONTINUATION_DIRECTIVE_PREFIX} The user just approved update_ticket${ticketHash}. ` +
    `Acknowledge the change in ONE short sentence; if anything else looks like it needs ` +
    `attention, ask. Do NOT call any tool in this turn.`
  )
}
