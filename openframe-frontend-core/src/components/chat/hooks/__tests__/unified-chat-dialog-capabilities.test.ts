/**
 * GOLDEN CONTRACT TEST — how `useUnifiedChat` resolves THE conversation-list
 * signal, `dialogCapabilities`.
 *
 * `EmbeddableChat` gates its entire history surface (rail, stacked list,
 * archive page, rename/archive menus, header search) on the presence of this
 * ONE object, and never on a transport name. This file pins the resolution
 * rule so that gate can never silently change meaning:
 *
 *   - GUIDE mode reports whatever the hub's engine reports — `undefined`
 *     without `chatConversationsUrl`, so a plain Guide panel stays
 *     single-thread even when a Mingo config is also present;
 *   - MINGO mode reports its engine's, which is always present: a live-tail
 *     panel owns a list, one with no affordances without `fetchDialogs`;
 *   - an engine a host provides (`ChatEngineProvider`) IS the Mingo mode: its
 *     capabilities are the panel's, and nothing is laid over them (what a host
 *     adds, the link to copy or Compact, is the engine's own configuration).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { ChatEngineProvider } from '../../engine/chat-engine-context';
import type { ChatDialogCapabilities, UnifiedChatState } from '../../types/unified-chat-state.types';
import { natsWsEngineConfig } from '../use-nats-chat-adapter';
import { useUnifiedChat, type UseUnifiedChatModes } from '../use-unified-chat';

const endpoints: ChatRuntime['endpoints'] = {
  chatStreamUrl: '/api/docs/chat',
  commandsUrl: '/api/docs/commands',
  buildListUrl: () => null,
  attachmentUploadUrl: '/api/storage/generate-upload-url',
  attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
  identityUrl: '/api/chat/identity',
};

function wrapperFor(runtime: ChatRuntime, engine?: UnifiedChatState) {
  return function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const inner = engine ? createElement(ChatEngineProvider, { engine }, children) : children;
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ChatRuntimeContext.Provider, { value: runtime }, inner),
    );
  };
}

const plainRuntime: ChatRuntime = { endpoints, navigation: { mode: 'host' }, source: 'unifiedsrc' };
const managedRuntime: ChatRuntime = {
  endpoints: { ...endpoints, chatConversationsUrl: '/api/docs/chat/conversations' },
  navigation: { mode: 'host' },
  source: 'unifiedsrc',
};

/** A Mingo mode config that is structurally valid but never opens a socket. */
const mingoMode: UseUnifiedChatModes['mingo'] = natsWsEngineConfig({
  dialogId: null,
  getNatsWsUrl: () => null,
  publishUserMessage: vi.fn(),
});

/** Minimal provided engine — only the fields this contract reads. */
function hostEngine(overrides: Partial<UnifiedChatState> = {}): UnifiedChatState {
  return { dialogs: [], activeDialogId: null, ...overrides } as unknown as UnifiedChatState;
}

function capsOf(options: Parameters<typeof useUnifiedChat>[0], runtime = plainRuntime, engine?: UnifiedChatState) {
  const { result } = renderHook(() => useUnifiedChat(options), { wrapper: wrapperFor(runtime, engine) });
  return result.current.dialogCapabilities;
}

describe('useUnifiedChat — dialogCapabilities resolution', () => {
  it('guide mode without a conversations endpoint has NO list, even beside a mingo config', () => {
    expect(capsOf({ modes: { guide: {}, mingo: mingoMode }, activeMode: 'guide' })).toBeUndefined();
  });

  it('guide mode WITH the endpoint reports the SSE adapter capabilities', () => {
    const caps = capsOf({ modes: { guide: {} }, activeMode: 'guide' }, managedRuntime);
    expect(caps).toMatchObject({ canRename: true, canArchive: true, emptyListSkipsToCompose: true });
  });

  it('mingo mode reports its engine object — the Mingo panel always owns a list', () => {
    const caps = capsOf({ modes: { mingo: mingoMode }, activeMode: 'mingo' }, managedRuntime);
    // Present despite the runtime endpoint, which belongs to the OTHER transport.
    expect(caps).toBeDefined();
    expect(caps?.emptyListSkipsToCompose).toBeUndefined();
  });

  it("a provided engine is the Mingo mode, its capabilities the panel's as they are", () => {
    const own: ChatDialogCapabilities = { canRename: true, onCopyLink: vi.fn() };
    const caps = capsOf({ modes: {}, activeMode: 'mingo' }, plainRuntime, hostEngine({ dialogCapabilities: own }));
    expect(caps).toBe(own);
  });

  it('a provided engine with no list is one thread', () => {
    expect(capsOf({ modes: {}, activeMode: 'mingo' }, plainRuntime, hostEngine())).toBeUndefined();
  });

  it('a provided engine does not stand for the Guide mode', () => {
    const caps = capsOf(
      { modes: { guide: {} }, activeMode: 'guide' },
      plainRuntime,
      hostEngine({ dialogCapabilities: { canRename: true } }),
    );
    expect(caps).toBeUndefined();
  });
});
