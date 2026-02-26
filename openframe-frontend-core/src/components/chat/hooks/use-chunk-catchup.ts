'use client'

import { useCallback, useRef, useEffect } from 'react'
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
function makeSeqKey(messageType: NatsMessageType, sequenceId: number): string {
  return `${messageType}:${sequenceId}`
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
  
  const fetchingInProgress = useRef(false)
  const lastFetchParams = useRef<{ dialogId: string; fromSequenceId?: number | null } | null>(null)
  
  // Buffer for NATS chunks that arrive during catchup
  const chunkBuffer = useRef<BufferedChunk[]>([])
  const bufferUntilInitialCatchupComplete = useRef(false)
  const hasCompletedInitialCatchup = useRef(false)
  
  const onChunkReceivedRef = useRef(onChunkReceived)
  useEffect(() => {
    onChunkReceivedRef.current = onChunkReceived
  }, [onChunkReceived])

  /**
   * Process a chunk, optionally buffering it if catchup is in progress
   */
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
      lastSequenceId.current = chunk.sequenceId
    }
    
    // Don't check for duplicates here - let all chunks through
    // Deduplication only happens during catchup merge
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

    buffered.sort((a, b) => {
      const seqA = a.chunk.sequenceId ?? 0
      const seqB = b.chunk.sequenceId ?? 0
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
    if (!dialogId) {
      return
    }
    
    if (hasCompletedInitialCatchup.current) {
      return
    }
    
    if (fetchingInProgress.current) {
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
          const chunks = await fetchChunks(dialogId, chatType, fromSequenceId)
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
      
      // Sort by sequence ID
      allChunks.sort((a, b) => {
        const seqA = a.chunk.sequenceId ?? 0
        const seqB = b.chunk.sequenceId ?? 0
        return seqA - seqB
      })
    
      // Deduplicate
      const uniqueAllChunks: BufferedChunk[] = []
      const seenInBatch = new Set<string>()
      for (const item of allChunks) {
        const k = makeBatchDedupKey(item)
        if (seenInBatch.has(k)) continue
        seenInBatch.add(k)
        uniqueAllChunks.push(item)
      }
      
      // Find last complete message boundary
      let lastMessageStartSeqId: number | null = null
      let lastMessageEndSeqId: number | null = null
      
      for (let i = uniqueAllChunks.length - 1; i >= 0; i--) {
        const seq = uniqueAllChunks[i].chunk.sequenceId
        if (uniqueAllChunks[i].chunk.type === MESSAGE_TYPE.MESSAGE_END && seq !== undefined && seq !== null) {
          lastMessageEndSeqId = seq
          break
        }
      }
      
      for (let i = uniqueAllChunks.length - 1; i >= 0; i--) {
        const chunk = uniqueAllChunks[i].chunk
        const seq = chunk.sequenceId
        if (chunk.type === MESSAGE_TYPE.MESSAGE_START && seq !== undefined && seq !== null) {
          if (lastMessageEndSeqId === null || seq > lastMessageEndSeqId) {
            lastMessageStartSeqId = seq
            break
          }
        }
      }
      
      let chunksToProcess: BufferedChunk[]
      
      if (lastMessageStartSeqId !== null) {
        // Process from the last incomplete message
        chunksToProcess = uniqueAllChunks.filter(item => 
          item.chunk.sequenceId !== undefined && 
          item.chunk.sequenceId >= lastMessageStartSeqId!
        )
      } else if (lastMessageEndSeqId !== null) {
        // Process only after the last complete message
        chunksToProcess = uniqueAllChunks.filter(item => 
          item.chunk.sequenceId !== undefined && 
          item.chunk.sequenceId > lastMessageEndSeqId!
        )
      } else {
        // Process all
        chunksToProcess = uniqueAllChunks
      }
      
      // Process the chunks
      chunksToProcess.forEach(({ chunk, messageType }) => {
        if (chunk.sequenceId !== undefined && chunk.sequenceId !== null) {
          processedSequenceKeys.current.add(makeSeqKey(messageType, chunk.sequenceId))
          lastSequenceId.current = chunk.sequenceId
        }
        onChunkReceivedRef.current(chunk, messageType)
      })

      bufferUntilInitialCatchupComplete.current = false
      hasCompletedInitialCatchup.current = true
    } catch (error) {
      console.error('Error during chunk catchup:', error)
    } finally {
      fetchingInProgress.current = false

      if (bufferUntilInitialCatchupComplete.current) {
        bufferUntilInitialCatchupComplete.current = false
        hasCompletedInitialCatchup.current = true
        flushBufferedRealtimeChunks()
      }
    }
  }, [dialogId, chatTypes, fetchChunks, flushBufferedRealtimeChunks])

  /**
   * Reset all tracking state
   */
  const resetChunkTracking = useCallback(() => {
    processedSequenceKeys.current.clear()
    lastSequenceId.current = null
    fetchingInProgress.current = false
    lastFetchParams.current = null
    chunkBuffer.current = []
    bufferUntilInitialCatchupComplete.current = false
    hasCompletedInitialCatchup.current = false
  }, [])

  /**
   * Start buffering NATS chunks for initial catchup
   */
  const startInitialBuffering = useCallback(() => {
    chunkBuffer.current = []
    bufferUntilInitialCatchupComplete.current = true
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
    if (!dialogId) return
    const fromSeq = lastSequenceId.current
    hasCompletedInitialCatchup.current = false
    lastFetchParams.current = null
    bufferUntilInitialCatchupComplete.current = true
    chunkBuffer.current = []
    await catchUpChunks(fromSeq)
  }, [dialogId, catchUpChunks])

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
