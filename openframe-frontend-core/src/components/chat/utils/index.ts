/**
 * Message processing utilities
 * Export all utilities for processing chat messages
 */

// Chunk parsing utilities
export {
  extractTextFromChunk,
  isControlChunk,
  isErrorChunk,
  isMetadataChunk,
  parseChunkToAction,
} from './chunk-parser';
// Incomplete message state extraction
export { extractIncompleteMessageState } from './extract-incomplete-message-state';
// Segment accumulator
export {
  type AccumulatorCallbacks,
  createMessageSegmentAccumulator,
  MessageSegmentAccumulator,
} from './message-segment-accumulator';
// Historical message processing
export {
  extractErrorMessages,
  processHistoricalMessages,
  processHistoricalMessagesWithErrors,
} from './process-historical-messages';
