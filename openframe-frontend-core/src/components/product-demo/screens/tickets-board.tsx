'use client';

import { useMemo } from 'react';
import { Board } from '../../features/board';
import { useProductDemoCast } from '../cast';
import { buildTicketsBoardFixture } from '../fixtures/tickets-board';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

/**
 * The lanes folded in the wide picture: the two that carry the story (what the
 * agents are on, what waits for a technician) stay open at full width, so no
 * lane is cut by the frame.
 */
const FOLDED = { ON_HOLD: true, RESOLVED: true };

/** The product's ticket board; the narrow rendering shows the lanes that carry the story. */
export default function TicketsBoardScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const board = useMemo(() => buildTicketsBoardFixture(cast), [cast]);
  const columns = compact ? board.filter(column => column.id !== 'ON_HOLD') : board;
  return (
    <div className="h-full bg-ods-bg p-[var(--spacing-system-m)]">
      <Board columns={columns} onChange={noop} initialCollapsed={compact ? undefined : FOLDED} />
    </div>
  );
}
