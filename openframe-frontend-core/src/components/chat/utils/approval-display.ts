/**
 * WHERE an approval card renders — the one rule, read by every path that turns
 * an approval into segments.
 *
 * There are three such paths and they must agree: the NATS kernel (live chunks),
 * the SSE kernel, and the history replay that rebuilds a dialog after a reload.
 * When the rule lived only in the live kernel, a Product Guide card rendered
 * inline while streaming and then moved into the escalation treatment on the
 * next page load — same card, two behaviors, and its buttons pointed at the
 * wrong backend once it moved.
 *
 * The rule itself: a card is gated on approval TIER (`displayApprovalTypes`,
 * the agent's own privilege model) UNLESS it came from the Product Guide, whose
 * proposals are typed by TOOL and are resolved through the hub's confirm route.
 * A hub proposal has no tier to gate on, so tier-gating one means escalating it
 * to a human who has no way to act on it.
 */

import type { GuideOrigin } from '../../../chat-protocol/events';
import { GUIDE_ORIGIN, isGuideOrigin } from '../../../chat-protocol/events';
import type { MessageSegment } from '../types/message.types';

/** Anything carrying the optional `origin` marker: a stream event, or the
 *  `data` of a rendered segment. */
interface OriginBearing {
  origin?: GuideOrigin | string;
}

/** True when this approval was minted by the Product Guide (the hub) rather
 *  than by the agent's own tool-approval tiering. */
export function isGuideApproval(source: OriginBearing | null | undefined): boolean {
  return isGuideOrigin(source);
}

/** The marker to stamp onto a built segment, or undefined for agent approvals.
 *  Keeps `origin` out of segment data unless it means something. */
export function guideApprovalOrigin(source: OriginBearing | null | undefined): GuideOrigin | undefined {
  return isGuideApproval(source) ? GUIDE_ORIGIN : undefined;
}

/**
 * Does this approval render inline in its turn (true), or take the consumer's
 * escalation treatment (false)?
 *
 * `displayApprovalTypes` undefined means "no tier gate configured" and every
 * agent approval displays — the pre-existing history-replay default, preserved
 * here so both kernels can share one predicate.
 */
export function approvalDisplaysInline(
  source: OriginBearing | null | undefined,
  approvalType: string,
  displayApprovalTypes?: readonly string[],
): boolean {
  if (isGuideApproval(source)) return true;
  return !displayApprovalTypes || displayApprovalTypes.includes(approvalType);
}

/**
 * True for a rendered segment that holds a Product Guide card (single or batch).
 *
 * Consumers use it to keep such a card in the message flow, where the hub's own
 * chat puts it, instead of lifting it into their sticky pending-approvals
 * footer — and to route its buttons to the hub rather than to the agent.
 */
export function isGuideApprovalSegment(segment: MessageSegment): boolean {
  if (segment.type !== 'approval_request' && segment.type !== 'approval_batch') return false;
  return isGuideApproval(segment.data);
}
