'use client'

import { useCallback, useRef } from 'react'
import {
  type ChunkData,
  type BufferedChunk,
  type NatsMessageType,
  type ChatType,
  type UseChunkCatchupOptions,
  type UseChunkCatchupReturn,
  CHAT_TYPE,
  MESSAGE_TYPE,
} from '../types'

/**
 * Creates a unique key for sequence tracking
 */
function makeSeqKey(messageType: NatsMessageType, chunkType: string, sequenceId: number): string {
  return `${messageType}:${chunkType}:${sequenceId}`
}

/**
 * Creates a unique key for batch deduplication
 */
function makeBatchDedupKey(item: BufferedChunk): string {
  const seq = item.chunk.sequenceId ?? 'na'
  const type = typeof item.chunk.type === 'string' ? item.chunk.type : 'na'
  const text = typeof item.chunk.text === 'string' ? item.chunk.text : ''
  const integratedToolType = typeof item.chunk.integratedToolType === 'string' ? item.chunk.integratedToolType : ''
  const toolFunction = typeof item.chunk.toolFunction === 'string' ? item.chunk.toolFunction : ''
  const approvalRequestId =
    typeof item.chunk.approvalRequestId === 'string'
      ? item.chunk.approvalRequestId
      : typeof item.chunk.approval_request_id === 'string'
        ? item.chunk.approval_request_id
        : ''

  return `${item.messageType}:${seq}:${type}:${text}:${integratedToolType}:${toolFunction}:${approvalRequestId}`
}

/**
 * Determines the message type for a given chat type
 */
function getChatTypeMessageType(chatType: ChatType): NatsMessageType {
  return chatType === CHAT_TYPE.ADMIN ? 'admin-message' : 'message'
}

/**
 * Hook for managing chunk catchup during dialog loading.
 * 
 * This hook handles:
 * - Buffering NATS chunks that arrive during catchup
 * - Fetching historical chunks from the API
 * - Deduplicating and ordering chunks
 * - Processing chunks in the correct order
 */
export function useChunkCatchup({
  dialogId,
  onChunkReceived,
  chatTypes = [CHAT_TYPE.CLIENT],
  fetchChunks,
}: UseChunkCatchupOptions): UseChunkCatchupReturn {
  const processedSequenceKeys = useRef<Set<string>>(new Set())
  const lastSequenceId = useRef<number | null>(null)
  // Per-messageType resume checkpoints. The legacy Redis transport keeps an
  // INDEPENDENT sequence counter per (dialog, chatType), so resuming every
  // stream from the single global `lastSequenceId` would permanently skip
  // the slower stream's newer chunks (one stream at seq 100, the other at
  // 20 → resuming both from 100 loses the second stream's 21+).
  const lastSequenceIdByType = useRef<Map<NatsMessageType, number>>(new Map())

  const fetchingInProgress = useRef(false)
  const lastFetchParams = useRef<{ dialogId: string; fromSequenceId?: number | null } | null>(null)
  // A catch-up requested while another fetch is in flight (double reconnect,
  // reconnect during the initial catchup). Queued instead of dropped: the old
  // behaviour returned early and the stale fetch's completion marked catchup
  // done, so the new gap was never fetched — a permanent transcript hole.
  // Scoped to its originating dialog — a rerun must never apply one dialog's
  // offset to another after a switch.
  const pendingCatchupRef = useRef<{ dialogId: string; fromSequenceId?: number | null } | null>(null)

  // Buffer for NATS chunks that arrive during catchup
  const chunkBuffer = useRef<BufferedChunk[]>([])
  const bufferUntilInitialCatchupComplete = useRef(false)
  const hasCompletedInitialCatchup = useRef(false)

  const dialogIdRef = useRef(dialogId)
  dialogIdRef.current = dialogId
  const chatTypesRef = useRef(chatTypes)
  chatTypesRef.current = chatTypes
  const fetchChunksRef = useRef(fetchChunks)
  fetchChunksRef.current = fetchChunks
  const onChunkReceivedRef = useRef(onChunkReceived)
  onChunkReceivedRef.current = onChunkReceived

  const processChunk = useCallback((
    chunk: ChunkData,
    messageType: NatsMessageType,
    forceProcess: boolean = false
  ): boolean => {
    if (bufferUntilInitialCatchupComplete.current && !forceProcess) {
      chunkBuffer.current.push({ chunk, messageType })
      return true
    }

    if (chunk.sequenceId !== undefined && chunk.sequenceId !== null) {
      const chunkType = typeof chunk.type === 'string' ? chunk.type : ''
      const key = makeSeqKey(messageType, chunkType, chunk.sequenceId)
      // A live chunk can also be in the catchup fetch result (published just
      // before the fetch resolved, delivered just after the flush). Without
      // this check the live path only RECORDED keys and never consulted
      // them, so the overlap rendered twice (duplicated text / tool cards).
      if (processedSequenceKeys.current.has(key)) return true
      processedSequenceKeys.current.add(key)
      lastSequenceId.current = chunk.sequenceId
      const prevTypeSeq = lastSequenceIdByType.current.get(messageType)
      if (prevTypeSeq === undefined || chunk.sequenceId > prevTypeSeq) {
        lastSequenceIdByType.current.set(messageType, chunk.sequenceId)
      }
    }

    onChunkReceivedRef.current(chunk, messageType)
    return true
  }, [])

  /**
   * Flush buffered realtime chunks after catchup is complete
   */
  const flushBufferedRealtimeChunks = useCallback(() => {
    if (chunkBuffer.current.length === 0) return
    const buffered = [...chunkBuffer.current]
    chunkBuffer.current = []

    // Chunks WITHOUT a sequence id are live deliveries — the newest events.
    // Sorting them as seq 0 (the old behaviour) pushed them BEFORE history.
    buffered.sort((a, b) => {
      const seqA = a.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER
      const seqB = b.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER
      return seqA - seqB
    })

    buffered.forEach(({ chunk, messageType }) => {
      processChunk(chunk, messageType, true)
    })
  }, [processChunk])

  /**
   * Fetch and process chunks from the API
   */
  const catchUpChunks = useCallback(async (fromSequenceId?: number | null) => {
    const dialogId = dialogIdRef.current
    const chatTypes = chatTypesRef.current
    const fetchChunks = fetchChunksRef.current

    if (!dialogId) {
      return
    }

    if (hasCompletedInitialCatchup.current) {
      // Safety valve: never leave the buffering flag stuck on a completed
      // catchup — buffered live chunks would otherwise queue forever and the
      // dialog would look frozen.
      if (bufferUntilInitialCatchupComplete.current) {
        bufferUntilInitialCatchupComplete.current = false
        flushBufferedRealtimeChunks()
      }
      return
    }

    if (fetchingInProgress.current) {
      // Queue instead of dropping — the in-flight fetch's finally block
      // re-runs catch-up with these params once it settles. An explicit
      // fromSequenceId wins; a queued INITIAL call (undefined) falls back to
      // the last seq seen so far (null on a fresh dialog → backend returns
      // everything, same as the original undefined semantics).
      pendingCatchupRef.current = { dialogId, fromSequenceId: fromSequenceId ?? lastSequenceId.current }
      return
    }

    if (lastFetchParams.current &&
        lastFetchParams.current.dialogId === dialogId &&
        lastFetchParams.current.fromSequenceId === fromSequenceId) {
      return
    }

    if (!fetchChunks) {
      bufferUntilInitialCatchupComplete.current = false
      hasCompletedInitialCatchup.current = true
      flushBufferedRealtimeChunks()
      return
    }

    fetchingInProgress.current = true
    lastFetchParams.current = { dialogId, fromSequenceId }

    try {
      // Fetch chunks for all configured chat types
      const chunkPromises = chatTypes.map(async (chatType) => {
        try {
          // Resume each stream from ITS OWN checkpoint: the legacy Redis
          // transport numbers each (dialog, chatType) stream independently,
          // so passing one global offset to every type would skip the slower
          // stream's newer chunks. `undefined` (initial load) still fetches
          // everything; a type we've never seen resumes from null (= all
          // unsaved chunks) rather than borrowing another stream's offset.
          const typeFromSequenceId =
            fromSequenceId === undefined
              ? undefined
              : (lastSequenceIdByType.current.get(getChatTypeMessageType(chatType)) ?? null)
          const chunks = await fetchChunks(dialogId, chatType, typeFromSequenceId)
          const messageType = getChatTypeMessageType(chatType)
          return chunks.map(chunk => ({ chunk, messageType }))
        } catch (error) {
          console.error(`Failed to fetch ${chatType} chunks:`, error)
          return []
        }
      })
      
      const allChunkResults = await Promise.all(chunkPromises)
      const allCatchupChunks: BufferedChunk[] = allChunkResults.flat()
      
      if (allCatchupChunks.length === 0) {
        flushBufferedRealtimeChunks()
        bufferUntilInitialCatchupComplete.current = false
        hasCompletedInitialCatchup.current = true
        return
      }
      
      // Combine catchup chunks with buffered NATS chunks
      const bufferedNatsChunks = [...chunkBuffer.current]
      chunkBuffer.current = []
      const allChunks = [...allCatchupChunks, ...bufferedNatsChunks]
      
      // Sort by sequence ID. Chunks without one are buffered live deliveries
      // (the newest events) — sort them AFTER history, not before it.
      allChunks.sort((a, b) => {
        const seqA = a.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER
        const seqB = b.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER
        return seqA - seqB
      })

      // Deduplicate — only chunks that carry a sequence id. Id-less live
      // chunks get no key: two identical streaming deltas ("the ", "yes")
      // are distinct content, and collapsing them (the old behaviour, where
      // the key degraded to type+text) silently dropped text.
      const uniqueAllChunks: BufferedChunk[] = []
      const seenInBatch = new Set<string>()
      for (const item of allChunks) {
        const hasSeq = item.chunk.sequenceId !== undefined && item.chunk.sequenceId !== null
        if (hasSeq) {
          const k = makeBatchDedupKey(item)
          if (seenInBatch.has(k)) continue
          seenInBatch.add(k)
        }
        uniqueAllChunks.push(item)
      }
      
      // Id-less chunks are buffered live deliveries (newer than anything the
      // fetch returned) — the boundary filters must KEEP them, not drop them.
      const hasNoSeq = (item: BufferedChunk) =>
        item.chunk.sequenceId === undefined || item.chunk.sequenceId === null

      // Boundary detection runs PER messageType. In the legacy Redis
      // transport each (dialog, chatType) stream has its OWN independent
      // sequence counter, so a MESSAGE_END boundary found in one stream must
      // never truncate the other stream's chunks (tool/approval chunks of an
      // admin mirror used to vanish this way). With JetStream's global seqs
      // the per-type grouping is still correct — it just partitions the same
      // ordered list.
      const byType = new Map<NatsMessageType, BufferedChunk[]>()
      for (const item of uniqueAllChunks) {
        const list = byType.get(item.messageType)
        if (list) list.push(item)
        else byType.set(item.messageType, [item])
      }

      const chunksToProcess: BufferedChunk[] = []
      for (const items of byType.values()) {
        // Find the last complete message boundary within this stream.
        let lastMessageStartSeqId: number | null = null
        let lastMessageEndSeqId: number | null = null

        for (let i = items.length - 1; i >= 0; i--) {
          const seq = items[i].chunk.sequenceId
          if (items[i].chunk.type === MESSAGE_TYPE.MESSAGE_END && seq !== undefined && seq !== null) {
            lastMessageEndSeqId = seq
            break
          }
        }

        for (let i = items.length - 1; i >= 0; i--) {
          const chunk = items[i].chunk
          const seq = chunk.sequenceId
          if (chunk.type === MESSAGE_TYPE.MESSAGE_START && seq !== undefined && seq !== null) {
            if (lastMessageEndSeqId === null || seq > lastMessageEndSeqId) {
              lastMessageStartSeqId = seq
              break
            }
          }
        }

        if (lastMessageStartSeqId !== null) {
          // Process from the last incomplete message
          chunksToProcess.push(
            ...items.filter(item => hasNoSeq(item) || item.chunk.sequenceId! >= lastMessageStartSeqId!),
          )
        } else if (lastMessageEndSeqId !== null) {
          // Process only after the last complete message
          chunksToProcess.push(
            ...items.filter(item => hasNoSeq(item) || item.chunk.sequenceId! > lastMessageEndSeqId!),
          )
        } else {
          // Process all
          chunksToProcess.push(...items)
        }
      }

      // Restore cross-stream order (concatenation above grouped by type).
      // Stable sort keeps per-type order; JetStream seqs interleave globally,
      // Redis-mode cross-type order is inherently undefined either way.
      chunksToProcess.sort((a, b) => {
        const seqA = a.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER
        const seqB = b.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER
        return seqA - seqB
      })
      
      // Process the chunks
      chunksToProcess.forEach(({ chunk, messageType }) => {
        if (chunk.sequenceId !== undefined && chunk.sequenceId !== null) {
          const chunkType = typeof chunk.type === 'string' ? chunk.type : ''
          const key = makeSeqKey(messageType, chunkType, chunk.sequenceId)
          if (processedSequenceKeys.current.has(key)) return
          processedSequenceKeys.current.add(key)
          lastSequenceId.current = chunk.sequenceId
          const prevTypeSeq = lastSequenceIdByType.current.get(messageType)
          if (prevTypeSeq === undefined || chunk.sequenceId > prevTypeSeq) {
            lastSequenceIdByType.current.set(messageType, chunk.sequenceId)
          }
        }
        onChunkReceivedRef.current(chunk, messageType)
      })

      bufferUntilInitialCatchupComplete.current = false
      hasCompletedInitialCatchup.current = true
    } catch (error) {
      console.error('Error during chunk catchup:', error)
    } finally {
      // A fetch whose dialog is no longer active must not touch the NEW
      // dialog's cycle state — `resetChunkTracking` already re-armed the
      // flags for it, and clearing `fetchingInProgress` / finalizing the
      // buffer here would corrupt the new dialog's in-flight catch-up.
      // That includes the pending queue: only discard an entry that belongs
      // to THIS stale dialog — a reconnect during the new dialog's initial
      // fetch queues an entry for the new dialog, and wiping it here would
      // silently drop that gap's re-fetch (permanent transcript hole).
      if (dialogId !== dialogIdRef.current) {
        if (pendingCatchupRef.current?.dialogId === dialogId) {
          pendingCatchupRef.current = null
        }
      } else {
        fetchingInProgress.current = false

        // A reset was requested mid-fetch: re-arm and re-run with the queued
        // params instead of finalizing on this (stale) fetch's results. The
        // success path above may have already flipped the completion flags —
        // reset them so the re-run isn't rejected by its own guards. A
        // pending entry from a DIFFERENT dialog is discarded, never replayed
        // against the current one.
        //
        // KNOWN LIMIT: the stale fetch may already have processed (and
        // flushed) chunks NEWER than the queued gap, so on an extreme
        // double-flap the gap's chunks can render after later ones — order
        // skew inside the bubble, but no content loss (strictly better than
        // the pre-fix permanent hole). Perfect ordering would require holding
        // the stale fetch's flush until the re-run completes, which isn't
        // worth the complexity for this corner.
        const pending = pendingCatchupRef.current
        if (pending) {
          pendingCatchupRef.current = null
          if (pending.dialogId === dialogId) {
            hasCompletedInitialCatchup.current = false
            lastFetchParams.current = null
            bufferUntilInitialCatchupComplete.current = true
            // AWAIT the re-run (not fire-and-forget): callers chain their own
            // finally on this promise — the adapter lowers its onAgentBusy
            // suppression there, and a detached re-run would replay a dead
            // tail's EXECUTING chunk with suppression already off, locking
            // the composer with no MESSAGE_END ever coming.
            try {
              await catchUpChunksRef.current?.(pending.fromSequenceId)
            } catch (rerunError) {
              console.error('Queued catch-up re-run failed:', rerunError)
            }
          } else if (bufferUntilInitialCatchupComplete.current) {
            bufferUntilInitialCatchupComplete.current = false
            hasCompletedInitialCatchup.current = true
            flushBufferedRealtimeChunks()
          }
        } else if (bufferUntilInitialCatchupComplete.current) {
          bufferUntilInitialCatchupComplete.current = false
          hasCompletedInitialCatchup.current = true
          flushBufferedRealtimeChunks()
        }
      }
    }
  }, [flushBufferedRealtimeChunks])

  // Self-reference for the queued re-run above (the callback can't name
  // itself inside its own useCallback initializer).
  const catchUpChunksRef = useRef<typeof catchUpChunks | null>(null)
  catchUpChunksRef.current = catchUpChunks

  /**
   * Reset all tracking state
   */
  const resetChunkTracking = useCallback(() => {
    processedSequenceKeys.current.clear()
    lastSequenceId.current = null
    lastSequenceIdByType.current.clear()
    fetchingInProgress.current = false
    lastFetchParams.current = null
    pendingCatchupRef.current = null
    chunkBuffer.current = []
    bufferUntilInitialCatchupComplete.current = false
    hasCompletedInitialCatchup.current = false
  }, [])

  /**
   * Start buffering NATS chunks for initial catchup
   */
  const startInitialBuffering = useCallback(() => {
    // Idempotent: a second reconnect while a back-fill is already buffering
    // (its history refetch still awaiting) must NOT clear the live chunks
    // collected so far — only a fresh start owns the buffer.
    if (!bufferUntilInitialCatchupComplete.current) {
      chunkBuffer.current = []
      bufferUntilInitialCatchupComplete.current = true
    }
    hasCompletedInitialCatchup.current = false
  }, [])

  /**
   * Check if buffering is currently active
   */
  const isBufferingActive = useCallback(() => bufferUntilInitialCatchupComplete.current, [])

  /**
   * Reset internal guards and re-run catch-up from the last known sequence ID.
   * Use after reconnection to fetch any messages missed during the disconnect.
   */
  const resetAndCatchUp = useCallback(async () => {
    if (!dialogIdRef.current) return
    const fromSeq = lastSequenceId.current
    hasCompletedInitialCatchup.current = false
    lastFetchParams.current = null
    if (!bufferUntilInitialCatchupComplete.current) {
      // Starting buffering fresh — drop stale leftovers. When the CALLER
      // already armed buffering (e.g. `startInitialBuffering()` before an
      // async history refetch on reconnect), KEEP the chunks it collected:
      // clearing here would silently discard everything delivered during
      // that await.
      chunkBuffer.current = []
      bufferUntilInitialCatchupComplete.current = true
    }
    await catchUpChunks(fromSeq)
  }, [catchUpChunks])

  return {
    catchUpChunks,
    processChunk,
    resetChunkTracking,
    startInitialBuffering,
    isBufferingActive,
    processedCount: processedSequenceKeys.current.size,
    resetAndCatchUp,
  }
}
