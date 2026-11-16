/**
 * The reducer options a chat thread is created with, written once for every NATS chat (the lib's engine, OpenFrame
 * Mingo and tickets, the Fae client).
 */

import type { ChatReducerEffect, ChatStreamReducerOptions } from '../stream/chat-stream-reducer';

/** The model a turn ran on, as the composer's badge shows it (kept outside the thread). */
export interface ChatModelMetadata {
  modelDisplayName: string;
  modelName: string;
  providerName: string;
  contextWindow: number;
}

export interface ChatThreadReducerOptionsConfig<K extends string> {
  /**
   * The viewer IS the admin (OpenFrame's operator): their own send comes back with ownerType 'ADMIN', and without this
   * the reducer leaves an ADMIN echo unconsumed (right where an ADMIN row is a technician's reply) and draws it twice.
   */
  ownEchoIncludesAdmin?: boolean;
  /**
   * The signed-in user, as a THUNK handed to the reducer as it is: options are read once, at creation, and a reducer
   * created before sign-in finished, or kept across a sign-out, would keep a stale id. The author check it feeds is what
   * keeps a pending echo from consuming another person's identical message.
   */
  selfUserId?: () => string | undefined;
  /** The model badge of a key's turn, with the app's non-optional fallbacks applied. Read when the effect fires. */
  onMetadata?: (key: K, metadata: ChatModelMetadata) => void;
}

export function chatThreadReducerOptions<K extends string>(
  config: ChatThreadReducerOptionsConfig<K> = {},
): (key: K) => ChatStreamReducerOptions {
  const { ownEchoIncludesAdmin, selfUserId, onMetadata } = config;
  return key => ({
    ...(ownEchoIncludesAdmin !== undefined ? { ownEchoIncludesAdmin } : {}),
    ...(selfUserId ? { selfUserId } : {}),
    onEffect: (effect: ChatReducerEffect) => {
      if (effect.name !== 'onMetadata') return;
      const [args] = effect.args;
      onMetadata?.(key, {
        modelDisplayName: args.modelDisplayName ?? args.modelName ?? '',
        modelName: args.modelName ?? '',
        providerName: args.providerName ?? '',
        contextWindow: args.contextWindow ?? 0,
      });
    },
  });
}
