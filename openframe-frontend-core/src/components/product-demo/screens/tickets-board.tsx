'use client';

import { Board } from '../../features/board';
import { TICKETS_BOARD_FIXTURE } from '../fixtures/tickets-board';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

/** The product's ticket board; the narrow rendering shows the lanes that carry the story. */
export default function TicketsBoardScreen({ compact = false }: ProductScreenViewProps) {
  const columns = compact ? TICKETS_BOARD_FIXTURE.filter(column => column.id !== 'ON_HOLD') : TICKETS_BOARD_FIXTURE;
  return (
    <div className="h-full bg-ods-bg p-[var(--spacing-system-m)]">
      <Board columns={columns} onChange={noop} />
    </div>
  );
}
