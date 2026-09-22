import { aimFromTarget, aimToChange } from './aim';
import type { BoardChange, BoardColumnDef } from './types';

/** What a drop carries: the card that moved, and what it was dropped onto. */
interface DropInput {
  /** `getInitialData` from the dragged card. */
  source: Record<string | symbol, unknown>;
  /** The innermost drop target under the pointer — a card, or a lane. */
  target: Record<string | symbol, unknown> | undefined;
}

/**
 * Turns a drop into the move to report, or `null` when nothing moved.
 *
 * Both steps live in `aim.ts`, shared with the keyboard and with the line drawn
 * during the drag: the target becomes a slot, the slot becomes a change. Having
 * the drop work it out separately is how a board ends up drawing a line in one
 * place and committing a move to another.
 */
export function resolveBoardDrop(
  columns: readonly BoardColumnDef[],
  { source, target }: DropInput,
): BoardChange | null {
  if (!target) return null;
  const ticketId = String(source.ticketId);
  const aim = aimFromTarget(columns, ticketId, target);
  return aim && aimToChange(columns, ticketId, aim);
}
