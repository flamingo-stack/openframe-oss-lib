'use client';

/**
 * The actions a record offers wherever the chat shows it: its card's "⋯" menu and its chip's "⋯" segment in a
 * sentence offer the SAME rows (`recordMenuGroups`: Ask Mingo or Display, Open Details with its ↗ new tab, Open in
 * ClickUp for a task), so a chip can do everything its card can.
 *
 * - `RecordActionsProvider`: the chat's own Ask and Display handlers (the ones its cards get), for every chip below it.
 * - `useRecordChipMenu`: the menu for a host's chip (the product's device or script chip), which the lib puts in
 *   context around each chip it asks the host for (`RecordChipProvider`).
 * - `RecordChipMenu`: the chip's "⋯", in its `trailing` slot (`InlineChip`), the one look for the lib's chip and a
 *   host's.
 */

import type React from 'react';
import { createContext, useContext } from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { Ellipsis01Icon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../ui/actions-menu';
import { Button } from '../ui/button';
import type { ChatRef } from './chat-ref.types';
import { recordMenuActions, recordMenuGroups } from './entity-cards/dispatch';

export interface RecordActionHandlers {
  /** "Ask Mingo" about a record: asks in the open conversation. */
  onDiscuss?: (ref: ChatRef) => void;
  /** "Display" a record whose card displays its document. */
  onDisplay?: (ref: ChatRef) => void;
  /**
   * A turn is running, so neither is on offer now: the record's menu shows the row disabled. Taking the row would empty the
   * "⋯" of a record with no page, and a chip without one is narrower, so its sentence would re-wrap at every turn.
   */
  held?: boolean;
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

/**
 * A record chip's "⋯": the button that opens the record's menu, set in the chip's `trailing` slot (`InlineChip`), so
 * the name and its actions are one box. `label` names the record for the button's accessible name.
 */
export function RecordChipMenu({
  menuGroups,
  label,
}: {
  menuGroups: ActionsMenuGroup[];
  label: string;
}): React.ReactElement {
  const ariaLabel = `Actions for ${label}`;
  return (
    <ActionsMenuDropdown
      groups={menuGroups}
      triggerAriaLabel={ariaLabel}
      onCloseAutoFocus={event => event.preventDefault()}
      customTrigger={
        <Button
          variant="transparent"
          type="button"
          aria-label={ariaLabel}
          className="!h-auto !min-h-0 !w-auto !min-w-0 !p-0 align-[-0.2em] text-ods-text-secondary hover:bg-transparent hover:text-ods-text-primary"
        >
          <Ellipsis01Icon className="size-4" />
        </Button>
      }
    />
  );
}
