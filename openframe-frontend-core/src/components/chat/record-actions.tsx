'use client';

/**
 * The actions a record offers wherever the chat shows it: its card's "⋯" menu and its chip's "⋯" segment in a
 * sentence offer the SAME rows (`recordMenuGroups`: Ask Mingo or Display, Open Details with its ↗ new tab, Open in
 * ClickUp for a task), so a chip can do everything its card can.
 *
 * - `RecordActionsProvider`: the chat's own Ask and Display handlers (the ones its cards get), for every chip below it.
 * - `useRecordChipMenu`: the menu for a host's chip (the product's device or script chip), which the lib puts in
 *   context around each chip it asks the host for (`RecordChipProvider`).
 * - `RecordChipActions`: the chip with its "⋯" segment, the one look for the lib's chip and a host's.
 */

import type React from 'react';
import { createContext, useContext } from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { cn } from '../../utils/cn';
import { Ellipsis01Icon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../ui/actions-menu';
import { Button } from '../ui/button';
import type { ChatRef } from './chat-ref.types';
import { recordMenuActions, recordMenuGroups } from './entity-cards/dispatch';
import { InlineChip } from './inline-chip';

export interface RecordActionHandlers {
  /** "Ask Mingo" about a record: asks in the open conversation. */
  onDiscuss?: (ref: ChatRef) => void;
  /** "Display" a record whose card displays its document. */
  onDisplay?: (ref: ChatRef) => void;
}

const RecordActionsContext = createContext<RecordActionHandlers>({});

export function RecordActionsProvider({ value, children }: { value: RecordActionHandlers; children: React.ReactNode }) {
  return <RecordActionsContext.Provider value={value}>{children}</RecordActionsContext.Provider>;
}

/** The chat's Ask and Display handlers; empty outside a chat (then no chip offers them). */
export function useRecordActions(): RecordActionHandlers {
  return useContext(RecordActionsContext);
}

/** The record a host's chip draws, as the record link names it. */
export interface RecordChipSubject {
  type: string;
  id: string;
  label: string;
}

const RecordChipContext = createContext<RecordChipSubject | null>(null);

/** Put around a chip the host draws for a record link, so the chip can read its record's actions. */
export function RecordChipProvider({ value, children }: { value: RecordChipSubject; children: React.ReactNode }) {
  return <RecordChipContext.Provider value={value}>{children}</RecordChipContext.Provider>;
}

/**
 * The "⋯" menu of the chip a host draws for a record link: the record's card menu (`recordMenuGroups` over
 * `recordMenuActions`, the card's own builder), given where the chip opens the record (`href`). Whether the new-tab
 * button is offered is the runtime's rule (`navigation.opensTabs`), the same for the card. `undefined` outside a
 * message's record link (a chip of an attached context item), so a chip there draws no menu.
 */
export function useRecordChipMenu({ href }: { href?: string | null }): ActionsMenuGroup[] | undefined {
  const record = useContext(RecordChipContext);
  const handlers = useRecordActions();
  const runtime = useChatRuntime();
  if (!record || !runtime) return undefined;
  const ref: ChatRef = { type: record.type, id: record.id, title: record.label, url: href ?? null };
  return recordMenuGroups(ref, recordMenuActions(ref, handlers, runtime));
}

/** The chip's lead segment, when its "⋯" segment follows it: the two read as one chip with a seam. */
export const RECORD_CHIP_LEAD_SEGMENT_CLASS = 'max-w-full rounded-r-none';
const MENU_SEGMENT_CLASS = 'rounded-l-none border-l-0 hover:bg-ods-bg-hover hover:[&_svg]:text-ods-text-primary';

/**
 * A record's chip followed by its "⋯" segment, which opens the record's menu. `children` is the lead segment (the
 * chip, usually inside its link), drawn with `RECORD_CHIP_LEAD_SEGMENT_CLASS`. The pair is no wider than what holds
 * it: the lead gives up its width first.
 */
export function RecordChipActions({
  menuGroups,
  label,
  children,
  className,
}: {
  menuGroups: ActionsMenuGroup[];
  /** The record's name, for the menu button's accessible name. */
  label: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const ariaLabel = `Actions for ${label}`;
  return (
    <span className={cn('inline-flex max-w-[min(16rem,100%)] align-middle', className)}>
      <span className="flex min-w-0">{children}</span>
      <ActionsMenuDropdown
        groups={menuGroups}
        triggerAriaLabel={ariaLabel}
        onCloseAutoFocus={event => event.preventDefault()}
        customTrigger={
          <Button
            variant="transparent"
            type="button"
            aria-label={ariaLabel}
            className="!h-auto !min-h-0 !w-auto !min-w-0 shrink-0 !p-0 align-middle hover:bg-transparent"
          >
            <InlineChip label={<Ellipsis01Icon />} className={MENU_SEGMENT_CLASS} />
          </Button>
        }
      />
    </span>
  );
}
