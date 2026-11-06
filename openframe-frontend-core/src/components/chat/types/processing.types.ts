/**
 * Message processing and transformation types
 */

import type { ChatApprovalStatus, AssistantType } from './chat.types';
import type { ChunkData } from './network.types';

// ========== Message Processing Options ==========

export interface MessageProcessingOptions {
  /** Assistant name to use (default: 'Fae') */
  assistantName?: string;
  /** Assistant type for styling (default: 'fae') */
  assistantType?: AssistantType;
  /** Avatar URL for assistant messages */
  assistantAvatar?: string;
  /** Filter by chat type (e.g., 'CLIENT_CHAT') */
  chatTypeFilter?: string;
  /** Statuses this client already knows, by approval id: they win over what the rows say, because the row that says it
   *  may not be on the fetched pages. */
  approvalStatuses?: Record<string, ChatApprovalStatus>;
  /**
   * Terminal escalation-offer states by offer id, from live chunks the host has already seen. An offer and its resolution
   * are two separate persisted rows, and the row with the resolution may not be on the fetched pages.
   */
  escalationOfferStates?: Record<string, ChatApprovalStatus>;
}

// ========== Stream Processing Types ==========

export interface StreamProcessor {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  getState: () => StreamState;
}

export interface StreamState {
  isActive: boolean;
  isPaused: boolean;
  messagesProcessed: number;
  chunksBuffered: number;
  lastProcessedAt?: Date;
  errors: Array<{ timestamp: Date; error: string }>;
}

// ========== Buffer Management Types ==========

export interface BufferManager {
  add: (chunk: ChunkData) => void;
  flush: () => ChunkData[];
  clear: () => void;
  size: () => number;
  isEmpty: () => boolean;
  isFull: () => boolean;
}

export interface BufferOptions {
  maxSize?: number;
  flushInterval?: number;
  onFlush?: (chunks: ChunkData[]) => void;
  onOverflow?: (droppedChunks: ChunkData[]) => void;
}
