/**
 * WHERE an approval card renders: the one rule.
 *
 * The part holds its tier (`approval.descriptor.approvalType`) however it arrived, live or from a row, and the thread
 * reads it here. When the rule lived in the live path alone, a card could render inline while streaming and then move into
 * the escalation treatment on the next page load: same card, two behaviors.
 */

/**
 * Does this approval render inline in its turn (true), or take the consumer's
 * escalation treatment (false)?
 *
 * A card is gated on approval TIER (`displayApprovalTypes`, the agent's own
 * privilege model). `undefined` means "no tier gate configured" and every
 * approval displays.
 */
export function approvalDisplaysInline(approvalType: string, displayApprovalTypes?: readonly string[]): boolean {
  return !displayApprovalTypes || displayApprovalTypes.includes(approvalType);
}
