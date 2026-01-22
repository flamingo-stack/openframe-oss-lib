/**
 * Message processing utilities
 * Export all utilities for processing chat messages
 */

// Chunk parsing utilities
export {
  parseChunkToAction,
  isControlChunk,
  isErrorChunk,
  isMetadataChunk,
  extractTextFromChunk,
} from './chunk-parser'

// Segment accumulator
export {
  MessageSegmentAccumulator,
  createMessageSegmentAccumulator,
  type AccumulatorCallbacks,
} from './message-segment-accumulator'

// Historical message processing
export {
  processHistoricalMessages,
  extractErrorMessages,
  processHistoricalMessagesWithErrors,
} from './process-historical-messages'
