/**
 * The ONE writer of a UI message stream: what the hub's chat, approval and display answers write through. It encodes each
 * chunk, keeps the parts those chunks build (the same `applyChunk` the client runs, so a stored row is what the reader
 * saw), and keeps the stream valid whatever path a turn ends on:
 *   - an open text id is closed before anything that is drawn after the text;
 *   - exactly one terminal chunk goes out, and `data: [DONE]` once, on every path.
 *
 * `sendStart: false, sendFinish: false` is a stream piped into another one (a continuation behind an approval's
 * receipts): its own `start`, `finish` and `[DONE]` stay out, and the metadata they carried still reaches the reader.
 *
 * Server-safe: no React, no browser APIs beyond TextEncoder.
 */

import { applyChunk, createWireState } from './apply-chunk';
import type { ChatPart } from './chat-message';
import { encodeUiChunk, encodeUiDone, type UiChunk } from './ui-chunks';

export interface UiMessageWriterOptions {
  sendStart?: boolean;
  sendFinish?: boolean;
}

export interface UiMessageWriter {
  write(chunk: UiChunk): void;
  /** The parts the chunks so far built. A row stores `storablePartsOf` of them. */
  parts(): ChatPart[];
  /** Ends the stream: closes what is open, then the terminal chunk if none went out, then `[DONE]`. Idempotent. */
  close(): void;
}

export function createUiMessageWriter(
  enqueue: (bytes: Uint8Array) => void,
  { sendStart = true, sendFinish = true }: UiMessageWriterOptions = {},
): UiMessageWriter {
  const wire = createWireState();
  const openText = new Set<string>();
  const openReasoning = new Set<string>();
  let parts: ChatPart[] = [];
  let started = false;
  let terminated = false;
  let closed = false;

  const send = (chunk: UiChunk): void => {
    enqueue(encodeUiChunk(chunk));
    parts = applyChunk(parts, chunk, wire);
  };

  const closeOpenText = (): void => {
    for (const id of openText) send({ type: 'text-end', id });
    openText.clear();
  };

  const closeOpenParts = (): void => {
    closeOpenText();
    for (const id of openReasoning) send({ type: 'reasoning-end', id });
    openReasoning.clear();
  };

  /** A chunk this writer keeps off the wire: what it says about the message still goes out. */
  const sendMetadataOnly = (chunk: Extract<UiChunk, { type: 'start' | 'finish' }>): void => {
    if (chunk.messageMetadata) send({ type: 'message-metadata', messageMetadata: chunk.messageMetadata });
  };

  return {
    write(chunk) {
      if (closed) return;
      switch (chunk.type) {
        case 'start':
          if (!sendStart || started) sendMetadataOnly(chunk);
          else send(chunk);
          started = true;
          return;
        case 'finish':
          closeOpenParts();
          if (terminated) return;
          terminated = true;
          if (sendFinish) send(chunk);
          else {
            sendMetadataOnly(chunk);
            parts = applyChunk(parts, chunk, wire);
          }
          return;
        case 'abort':
        case 'error':
          closeOpenParts();
          if (terminated) return;
          terminated = true;
          send(chunk);
          return;
        case 'text-start':
          openText.add(chunk.id);
          break;
        case 'text-end':
          openText.delete(chunk.id);
          break;
        case 'reasoning-start':
          openReasoning.add(chunk.id);
          break;
        case 'reasoning-end':
          openReasoning.delete(chunk.id);
          break;
        case 'text-delta':
        case 'reasoning-delta':
        case 'source-url':
        case 'source-document':
        case 'message-metadata':
          break;
        default:
          // Sits after the text so far. A transient chunk is not drawn in the message at all.
          if (!('transient' in chunk && chunk.transient)) closeOpenText();
      }
      send(chunk);
    },
    parts: () => parts,
    close() {
      if (closed) return;
      closeOpenParts();
      if (sendFinish) {
        if (!terminated) send({ type: 'finish', finishReason: 'other' });
        enqueue(encodeUiDone());
      }
      terminated = true;
      closed = true;
    },
  };
}
