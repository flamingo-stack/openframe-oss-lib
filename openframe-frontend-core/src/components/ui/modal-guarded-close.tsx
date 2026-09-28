'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { Button } from './button';
import { ModalV2, ModalV2Content, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';

/**
 * The unified dirty-state contract for modals: a promise-based house confirm
 * (`useConfirm`), a close guard that asks before discarding unsaved edits
 * (`useGuardedClose`), and the standing "Unsaved changes" footer chip
 * (`UnsavedChangesChip`). Form-modal shells compose these three instead of
 * reimplementing the affordance — closing a dirty form must never silently
 * discard the edits, and the chip is the standing signal that edits exist.
 */

/**
 * State-driven confirm dialog using `ModalV2` — the house replacement for
 * `window.confirm`. `ask(title, body)` returns a `Promise<boolean>`; the
 * consumer awaits the user's choice and then proceeds. The returned `dialog`
 * element MUST be rendered in the host's JSX (inside the host modal is fine —
 * `ModalV2` stacks).
 *
 * Concurrency: a second `ask` while a dialog is already open resolves `false`
 * immediately — without the guard the second `setPending` would overwrite the
 * first entry and the first Promise would hang forever. The ref-based
 * in-flight flag also covers two synchronous `ask()` calls in the same render
 * tick, which `useState` alone races.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{
    title: string;
    body: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const askingRef = useRef(false);
  // Mirror of the active request, so unmount cleanup can settle it without
  // depending on (already-frozen) state.
  const pendingRef = useRef<{ resolve: (ok: boolean) => void } | null>(null);
  const ask = useCallback((title: string, body: string) => {
    return new Promise<boolean>(resolve => {
      if (askingRef.current) {
        resolve(false);
        return;
      }
      askingRef.current = true;
      const entry = { title, body, resolve };
      pendingRef.current = entry;
      setPending(entry);
      setOpen(true);
    });
  }, []);
  const decide = useCallback(
    (ok: boolean) => {
      askingRef.current = false;
      // Clear the ref FIRST so a later unmount cleanup can't re-resolve a
      // request the user already decided.
      pendingRef.current = null;
      setOpen(false);
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );
  // Host unmounted while the confirmation was open: the decision UI is gone,
  // so settle the promise as "no" — otherwise the caller awaits forever.
  useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
      askingRef.current = false;
    },
    [],
  );

  const dialog = pending ? (
    <ModalV2 isOpen={open} onClose={() => decide(false)}>
      <ModalV2Header>
        <ModalV2Title>{pending.title}</ModalV2Title>
      </ModalV2Header>
      <ModalV2Content>
        <p className="text-ods-text-secondary text-h6">{pending.body}</p>
      </ModalV2Content>
      <ModalV2Footer>
        <Button variant="outline" onClick={() => decide(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => decide(true)}>
          Confirm
        </Button>
      </ModalV2Footer>
    </ModalV2>
  ) : null;

  return { ask, dialog };
}

export interface UseGuardedCloseOptions {
  /** Confirm dialog title. */
  title?: string;
  /** Confirm dialog body. */
  body?: string;
}

/**
 * Close guard for dirty forms: `guardedClose` runs `onClose` directly while
 * clean, and asks the house confirm first once `dirty` — wire it to the
 * modal's `onClose` AND the Cancel button so every dismissal path is guarded.
 * Render the returned `dialog` in the host's JSX.
 */
export function useGuardedClose(
  dirty: boolean,
  onClose: () => void,
  {
    title = 'Discard unsaved changes?',
    body = 'Your edits have not been saved. Close and discard them?',
  }: UseGuardedCloseOptions = {},
) {
  const { ask, dialog } = useConfirm();
  const guardedClose = useCallback(async () => {
    if (dirty && !(await ask(title, body))) return;
    onClose();
  }, [dirty, ask, title, body, onClose]);
  return { guardedClose, dialog };
}

export interface UnsavedChangesChipProps {
  /** Names WHAT is dirty (hover tooltip) — turns "why is this dirty?!" into a hover. */
  detail?: string;
  className?: string;
}

/** The standing "Unsaved changes" signal for a dirty modal's footer. */
export function UnsavedChangesChip({ detail, className }: UnsavedChangesChipProps) {
  return (
    <span className={cn('text-ods-warning text-h6', className)} role="status" title={detail}>
      Unsaved changes
    </span>
  );
}
