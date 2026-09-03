/**
 * WHERE an approval card renders — the one rule, read by every path that turns
 * an approval into segments.
 *
 * There are three such paths and they must agree: the NATS kernel (live chunks),
 * the SSE kernel, and the history replay that rebuilds a dialog after a reload.
 * When the rule lived only in the live kernel, a card could render inline while
 * streaming and then move into the escalation treatment on the next page load —
 * same card, two behaviors.
 */

/**
 * Does this approval render inline in its turn (true), or take the consumer's
 * escalation treatment (false)?
 *
 * A card is gated on approval TIER (`displayApprovalTypes`, the agent's own
 * privilege model). `undefined` means "no tier gate configured" and every
 * approval displays — the pre-existing history-replay default, preserved here
 * so both kernels can share one predicate.
 */
export function approvalDisplaysInline(approvalType: string, displayApprovalTypes?: readonly string[]): boolean {
  return !displayApprovalTypes || displayApprovalTypes.includes(approvalType);
}
