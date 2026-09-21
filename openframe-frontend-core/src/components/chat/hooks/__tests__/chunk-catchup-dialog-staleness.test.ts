import { renderHook, act } from '@testing-library/react';
/**
 * A catch-up fetch is async and the active dialog can change while it is in
 * flight — switching dialogs is the ordinary interaction, not an edge case.
 *
 * `useChunkCatchup` already knows about staleness, but only in its `finally`:
 * the processing loop ran FIRST and unconditionally. Everything downstream of
 * it is bound to the CURRENT dialog — `onChunkReceived` is read through a ref
 * the adapter reassigns every render, and the seq bookkeeping refs were just
 * re-armed by `resetChunkTracking` for the newly-entered dialog — so a fetch
 * that resolved late wrote dialog A's transcript into dialog B, and pushed B's
 * seq cursor to A's JetStream sequence. Since the reducer drops anything at or
 * below `lastAppliedSeq`, and A's stream position is unrelated to B's, that can
 * silently discard B's own live chunks for the rest of the session.
 *
 * The same applies to the flags: finalizing `hasCompletedInitialCatchup` /
 * `bufferUntilInitialCatchupComplete` on a stale fetch ends the NEW dialog's
 * buffering window early, and draining `chunkBuffer` hands B's buffered live
 * deliveries to A's stale batch.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ChunkData } from '../../types';
import { useChunkCatchup } from '../use-chunk-catchup';

type Deferred = {
  promise: Promise<ChunkData[]>;
  resolve: (chunks: ChunkData[]) => void;
};

function deferred(): Deferred {
  let resolve!: (chunks: ChunkData[]) => void;
  const promise = new Promise<ChunkData[]>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const textChunk = (text: string, streamSeq: number, sequenceId: number): ChunkData => ({
  type: 'TEXT',
  text,
  streamSeq,
  sequenceId,
});

describe('useChunkCatchup — dialog staleness', () => {
  it('does not deliver a catchup that resolved after the dialog changed', async () => {
    const onChunkReceived = vi.fn();
    const pending = deferred();
    const fetchChunks = vi.fn((dialogId: string) => (dialogId === 'A' ? pending.promise : Promise.resolve([])));

    const { result, rerender } = renderHook(
      ({ dialogId }: { dialogId: string }) => useChunkCatchup({ dialogId, onChunkReceived, fetchChunks }),
      { initialProps: { dialogId: 'A' } },
    );

    // Dialog A starts its catch-up…
    let catchup!: Promise<unknown>;
    act(() => {
      catchup = result.current.catchUpChunks();
    });
    expect(fetchChunks).toHaveBeenCalledWith('A', expect.anything(), undefined);

    // …the user switches to B while A's fetch is still open…
    rerender({ dialogId: 'B' });

    // …and only then does A's fetch land, carrying A's own transcript.
    await act(async () => {
      pending.resolve([textChunk('SECRET FROM DIALOG A', 100001, 100001)]);
      await catchup;
    });

    expect(onChunkReceived).not.toHaveBeenCalled();
  });

  it('still delivers a catchup for the dialog that is current when it lands', () => {
    const onChunkReceived = vi.fn();
    const fetchChunks = vi.fn(() => Promise.resolve([textChunk('B REAL CONTENT', 50001, 50001)]));

    const { result } = renderHook(() => useChunkCatchup({ dialogId: 'B', onChunkReceived, fetchChunks }));

    return act(async () => {
      await result.current.catchUpChunks();
    }).then(() => {
      // Positive control: the guard must not swallow the normal path.
      expect(onChunkReceived).toHaveBeenCalledTimes(1);
      expect(onChunkReceived.mock.calls[0][0]).toMatchObject({ text: 'B REAL CONTENT' });
    });
  });

  /**
   * The dialog-identity gate above is NOT sufficient on its own. Two catch-up
   * runs can be in flight for the SAME dialog id: `resetChunkTracking()`
   * releases the in-flight lock unconditionally and the adapter's activation
   * effect calls it immediately before starting a fresh `catchUpChunks()`. That
   * effect re-runs whenever `active` flips off and back on, or whenever the
   * host re-opens the conversation it was already on (dialog id X → null → X)
   * — both ordinary interactions, both able to land inside the fetch window.
   *
   * With only the identity gate the older run passed it, applied its stale
   * snapshot, closed the newer run's buffering window and flushed the newer
   * run's buffered live deliveries into its own batch. Everything the newer
   * fetch then delivered sat at or below the seq cursor that flush had already
   * advanced, and the reducer drops anything at or below `lastAppliedSeq` — so
   * the transcript silently lost chunks (and the ones that survived rendered
   * out of order). The run token closes it: only the run that still owns the
   * cycle may apply chunks or finalize flags.
   */
  it('drops a catch-up superseded by a re-activation of the same dialog', async () => {
    const onChunkReceived = vi.fn();
    const stale = deferred();
    const fresh = deferred();
    const responses = [stale.promise, fresh.promise];
    const fetchChunks = vi.fn(() => responses.shift() ?? Promise.resolve([]));

    const { result } = renderHook(() => useChunkCatchup({ dialogId: 'A', onChunkReceived, fetchChunks }));

    // Run #1 — the initial catch-up for dialog A.
    let firstRun!: Promise<unknown>;
    act(() => {
      firstRun = result.current.catchUpChunks();
    });

    // The host re-activates the SAME dialog while run #1 is still open.
    let secondRun!: Promise<unknown>;
    act(() => {
      result.current.resetChunkTracking();
      result.current.startInitialBuffering();
      secondRun = result.current.catchUpChunks();
    });
    expect(fetchChunks).toHaveBeenCalledTimes(2);

    // Run #1 lands late, carrying the snapshot it took before the reset.
    await act(async () => {
      stale.resolve([textChunk('STALE SNAPSHOT', 10, 10)]);
      await firstRun;
    });

    expect(onChunkReceived).not.toHaveBeenCalled();
    // …and the buffering window still belongs to run #2.
    expect(result.current.isBufferingActive()).toBe(true);

    // So a live chunk arriving now is still buffered, not raced ahead of the
    // history run #2 is about to deliver.
    act(() => {
      result.current.processChunk(textChunk('LIVE', 30, 30), 'message');
    });
    expect(onChunkReceived).not.toHaveBeenCalled();

    await act(async () => {
      fresh.resolve([textChunk('HISTORY', 20, 20)]);
      await secondRun;
    });

    expect(onChunkReceived.mock.calls.map(call => (call[0] as ChunkData).text)).toEqual(['HISTORY', 'LIVE']);
  });
});
