'use client';

/**
 * useStreamTurns: the turns of a STREAM transport (`ChatStreamTransport`), for the engine. A send is a request whose
 * response is the answer, read chunk by chunk through the thread's reducer:
 *
 *   transport.openTurn ─→ UiChunk ─→ ChatThreadStore (the reducers)
 *
 * What is here is what a stream has and a live tail does not: the request being open (`streamOpen`), a turn that is
 * its stream's to end, Stop as an abort, the dialog the server mints in the stream, and an approval answered by a
 * request of its own whose answer continues the card's message.
 *
 * Engine-internal: `useChatEngine` runs it, and a host never does.
 */

import { useCallback, useRef, useState } from 'react';
import { approvalStatusOf, isToolPart, type ChatMessage, type ChatToolPart } from '../../../chat-protocol/chat-message';
import type { UnifiedSendMessageOptions } from '../types/unified-chat-state.types';
import type { WireCommandOverride } from '../utils/slash-dispatch-utils';
import type { ChatThreadStore } from './chat-thread-store';
import { ChatTurnRefused, type ChatStreamTransport, type ChatStreamTurn } from './chat-transport';

/** What a row says when nothing said how its approval ended: a stream that was cut or stopped. It may have run. */
export const APPROVAL_OUTCOME_UNKNOWN =
  'The answer stopped before saying how this ended, so it may or may not have gone through. Check before trying again.';

/** What a row says when the server refused with no words of its own, a gateway's page say. */
export const APPROVAL_REFUSED = 'The server refused this, so it did not run.';

/** The parts of one approval: the row it names, and when that row is in a batch, the whole batch. Only what still waits. */
function pendingApprovalParts(message: ChatMessage, id: string): ChatToolPart[] {
  const tools = message.parts.filter(isToolPart);
  const named = tools.find(part => 'approval' in part && part.approval?.id === id);
  const batchId = (named && 'approval' in named ? named.approval?.descriptor?.batchId : undefined) ?? id;
  return tools.filter(
    part =>
      approvalStatusOf(part) === 'pending' &&
      'approval' in part &&
      (part.approval?.id === id || part.approval?.descriptor?.batchId === batchId),
  );
}

/** The asked-for parts no answer reached: they still read as answered and waiting on their tool. */
function unansweredParts(messages: readonly ChatMessage[], asked: readonly ChatToolPart[]): ChatToolPart[] {
  const held = new Map(messages.flatMap(message => message.parts.filter(isToolPart)).map(p => [p.toolCallId, p]));
  return asked.filter(part => held.get(part.toolCallId)?.state === 'approval-responded');
}

/** The newest message holding a pending approval this id names. */
function cardOfApproval(
  messages: readonly ChatMessage[],
  id: string,
): { message: ChatMessage; parts: ChatToolPart[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = pendingApprovalParts(messages[i], id);
    if (parts.length > 0) return { message: messages[i], parts };
  }
  return null;
}

function isAbort(err: unknown, ctrl: AbortController): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError' || ctrl.signal.aborted;
}

export interface StreamTurnSend extends UnifiedSendMessageOptions {
  /** Narrows retrieval to one record: a card's "Discuss". */
  commandOverride?: WireCommandOverride;
}

export interface UseStreamTurnsArgs {
  /** The engine's transport when it is a stream; null for a live tail, and nothing here does anything. */
  transport: ChatStreamTransport | null;
  store: ChatThreadStore<string>;
  /** The key the open dialog's thread is kept under, and the open dialog, read when a turn starts. */
  currentKey: () => string;
  currentDialogId: () => string | null;
  /** The server named the dialog this turn's request minted: the engine opens it, its thread kept under `key`. */
  onMinted: (dialogId: string, key: string, hidden: boolean) => void;
  /** A turn ended: `minted` when its request created the dialog it went into. */
  onSettled: (minted: boolean) => void;
}

export interface StreamTurns {
  /** Resolves true on a clean turn, false when the request failed or a stream is already open. Never rejects. */
  send: (text: string, options?: StreamTurnSend) => Promise<boolean>;
  /** Answer an approval by its id or its batch's id. False when a row ended with no answer, or a stream is open. */
  answer: (id: string, approved: boolean, reason?: string) => Promise<boolean>;
  /** End the turn where it is: what it said stays, marked aborted. */
  stop: () => void;
  /** Stop the stream writing, the turn left to whoever is next (a switch, a new chat). */
  abort: () => void;
  /** From the request until its reader has stopped. */
  streamOpen: boolean;
  /** The message the running turn writes into, held until its reader has stopped. */
  writingMessageId: (fromState: string | null) => string | null;
}

export function useStreamTurns({
  transport,
  store,
  currentKey,
  currentDialogId,
  onMinted,
  onSettled,
}: UseStreamTurnsArgs): StreamTurns {
  const abortControllerRef = useRef<AbortController | null>(null);
  // Render-visible mirror of the ref: from the request until its reader has stopped.
  const [streamOpen, setStreamOpen] = useState(false);
  const openStream = useCallback((ctrl: AbortController) => {
    abortControllerRef.current = ctrl;
    setStreamOpen(true);
  }, []);
  /** Whether the turn is still this stream's to end: a stopped one may be followed by a send before its reader has stopped. */
  const closeStream = useCallback((ctrl: AbortController): boolean => {
    if (abortControllerRef.current !== ctrl) return false;
    abortControllerRef.current = null;
    setStreamOpen(false);
    return true;
  }, []);
  /** Stopped or left, a stream writes no more, whatever its reader is still doing. */
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setStreamOpen(false);
  }, []);
  /**
   * A stream writes where the wire names and Stop reaches one request, so anything sent on top of one takes both: its answer
   * lands under the new question, and Stop misses the stream still writing.
   */
  const isStreamWriting = useCallback(() => {
    const ctrl = abortControllerRef.current;
    return ctrl !== null && !ctrl.signal.aborted;
  }, []);

  // The latest callbacks, for a turn that outlives the render it started in.
  const portsRef = useRef({ transport, currentKey, currentDialogId, onMinted, onSettled });
  portsRef.current = { transport, currentKey, currentDialogId, onMinted, onSettled };

  /**
   * One request and the stream it answers, chunk by chunk through the reducer of `key`. Throws on a refused or failed
   * request; an abort ends it, and what arrived stays. Returns whether this stream minted the dialog.
   */
  const streamInto = useCallback(
    async (key: string, turn: ChatStreamTurn, ctrl: AbortController, hidden: boolean): Promise<boolean> => {
      const port = portsRef.current.transport;
      if (!port) throw new Error('This chat has no stream transport.');
      const chunks = await port.openTurn(turn, ctrl.signal);
      let minted = false;
      const thread = store.bind(key);
      for await (const chunk of chunks) {
        if (ctrl.signal.aborted) break;
        const dialogId = port.dialogIdOf?.(chunk) ?? null;
        if (dialogId && dialogId !== portsRef.current.currentDialogId()) {
          minted = true;
          portsRef.current.onMinted(dialogId, key, hidden);
        }
        thread.apply({ chunks: [chunk] });
      }
      return minted;
    },
    [store],
  );

  const send = useCallback(
    async (text: string, options?: StreamTurnSend): Promise<boolean> => {
      const port = portsRef.current.transport;
      if (!port || isStreamWriting()) return false;
      const { hidden = false, attachments = [], commandOverride } = options ?? {};
      const key = portsRef.current.currentKey();
      const files = port.filePartsOf?.(attachments) ?? [];
      // Optimistic user bubble + assistant placeholder + phase 'thinking': one reducer command.
      store.mutate(key, r => r.beginSseSend({ text, files, hidden }));

      const ctrl = new AbortController();
      openStream(ctrl);
      let minted = false;
      try {
        minted = await streamInto(
          key,
          {
            kind: 'message',
            dialogId: portsRef.current.currentDialogId(),
            text,
            files,
            ...(commandOverride ? { commandOverride } : {}),
          },
          ctrl,
          hidden,
        );
        return true;
      } catch (err) {
        // A user's Stop: the partial answer stays with no error row, and it is no failure (the request may have
        // committed server-side).
        if (isAbort(err, ctrl)) return true;
        store.flush();
        store.mutate(key, r =>
          r.failTurn(err instanceof Error ? err.message : 'An error occurred while processing your request.'),
        );
        return false;
      } finally {
        const turnIsOurs = closeStream(ctrl);
        // Land the pending deltas BEFORE the turn settles (it drops an empty trailing placeholder and idles the phase).
        store.flush();
        if (turnIsOurs) store.mutate(key, r => r.endSseTurn());
        if (!ctrl.signal.aborted) portsRef.current.onSettled(minted);
      }
    },
    [store, streamInto, openStream, closeStream, isStreamWriting],
  );

  /**
   * The standard's round trip (`addToolApprovalResponse`, then "send only the last message"): the parts flip, the card's
   * message becomes the one being built, and the card's message goes back holding the answered parts. The answer
   * continues that message: an output or a denial per part (a refusal is an error on ITS part, so one row of a batch can
   * fail and the others proceed), the receipt, and the auto-continuation.
   */
  const answer = useCallback(
    async (id: string, approved: boolean, reason?: string): Promise<boolean> => {
      if (!portsRef.current.transport || isStreamWriting()) return false;
      const key = portsRef.current.currentKey();
      store.flush();
      const card = cardOfApproval(store.snapshotOf(key).messages, id);
      if (!card) return false;
      const { message, parts } = card;
      const thread = store.bind(key);
      for (const part of parts) {
        const approvalId = 'approval' in part ? part.approval?.id : undefined;
        if (!approvalId) continue;
        thread.apply({
          chunks: [
            {
              type: 'tool-approval-response',
              approvalId,
              approved,
              ...(reason !== undefined ? { reason } : {}),
              toolMetadata: { answerSent: true },
            },
          ],
        });
      }
      store.mutate(key, r => r.continueMessage(message.id));

      const ctrl = new AbortController();
      openStream(ctrl);
      let ok = true;
      let minted = false;
      // A row left waiting would spin for good: nothing else stops its loader, and a card is never stored for a reload to
      // settle it. A refused request fails its rows with what the server said; anything else that left a row unanswered
      // (a cut, Stop, no answer, a 5xx that may be a gateway's word about a write still running) says nobody knows.
      let refusal: string | null = null;
      try {
        minted = await streamInto(
          key,
          {
            kind: 'approval',
            dialogId: portsRef.current.currentDialogId(),
            message,
            parts,
            approved,
            ...(reason !== undefined ? { reason } : {}),
          },
          ctrl,
          true,
        );
      } catch (err) {
        if (err instanceof ChatTurnRefused) refusal = err.serverMessage ?? APPROVAL_REFUSED;
      }
      store.flush();
      for (const part of unansweredParts(store.snapshotOf(key).messages, parts)) {
        thread.apply({
          chunks: [
            {
              type: 'tool-output-error',
              toolCallId: part.toolCallId,
              dynamic: true,
              errorText: refusal ?? APPROVAL_OUTCOME_UNKNOWN,
              ...(refusal === null ? { toolMetadata: { outcomeUnknown: true } } : {}),
            },
          ],
        });
        ok = false;
      }
      const turnIsOurs = closeStream(ctrl);
      store.flush();
      if (turnIsOurs) store.mutate(key, r => r.endSseTurn());
      if (!ctrl.signal.aborted) portsRef.current.onSettled(minted);
      return ok;
    },
    [store, streamInto, openStream, closeStream, isStreamWriting],
  );

  const stop = useCallback(() => {
    abort();
    store.flush();
    // The turn ends here: what it said stays, and nothing is left reading as streaming.
    store.bind(portsRef.current.currentKey()).apply({ chunks: [{ type: 'abort', reason: 'user' }] });
  }, [abort, store]);

  // `finish` stops naming the message, and the turn runs until its reader has stopped: until then it is still the one
  // being written, or the last message, a newer answer perhaps, would read as being written and rebuild its text.
  const lastWrittenRef = useRef<string | null>(null);
  const writingMessageId = (fromState: string | null): string | null => {
    lastWrittenRef.current = fromState ?? (streamOpen ? lastWrittenRef.current : null);
    return lastWrittenRef.current;
  };

  return { send, answer, stop, abort, streamOpen, writingMessageId };
}
