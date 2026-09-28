/**
 * GOLDEN CONTRACT TEST — how `useUnifiedChat` resolves THE conversation-list
 * signal, `dialogCapabilities`.
 *
 * `EmbeddableChat` gates its entire history surface (rail, stacked list,
 * archive page, rename/archive menus, header search) on the presence of this
 * ONE object, and never on a transport name. This file pins the resolution
 * rule so that gate can never silently change meaning:
 *
 *   - GUIDE mode reports whatever the SSE adapter reports — `undefined`
 *     without `chatConversationsUrl`, so a plain Guide panel stays
 *     single-thread even when a Mingo config is also present;
 *   - MINGO mode reports the NATS adapter's object, which is always present;
 *   - a HOST-INJECTED state (`mingoStateOverride`) that carries no
 *     capabilities of its own falls back to the `injectedDialogCapabilities`
 *     companion, and to an EMPTY object when the host passes neither — so
 *     injecting a state never costs a host its list surface;
 *   - capabilities ON the injected state win over the companion prop.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context';
import type { ChatDialogCapabilities, UnifiedChatState } from '../../types/unified-chat-state.types';
import { useUnifiedChat, type UseUnifiedChatModes } from '../use-unified-chat';

const endpoints: ChatRuntime['endpoints'] = {
  chatStreamUrl: '/api/docs/chat',
  approvalToolUrl: '/api/chat/agent/confirm-tool',
  commandsUrl: '/api/docs/commands',
  buildListUrl: () => null,
  attachmentUploadUrl: '/api/storage/generate-upload-url',
  attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
  identityUrl: '/api/chat/identity',
};

function wrapperFor(runtime: ChatRuntime) {
  return function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ChatRuntimeContext.Provider, { value: runtime }, children),
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
const mingoMode: UseUnifiedChatModes['mingo'] = {
  dialogId: null,
  getNatsWsUrl: () => null,
  publishUserMessage: vi.fn(),
};

/** Minimal host-built state — only the fields this contract reads. */
function injectedState(overrides: Partial<UnifiedChatState> = {}): UnifiedChatState {
  return { dialogs: [], activeDialogId: null, ...overrides } as unknown as UnifiedChatState;
}

function capsOf(options: Parameters<typeof useUnifiedChat>[0], runtime = plainRuntime) {
  const { result } = renderHook(() => useUnifiedChat(options), { wrapper: wrapperFor(runtime) });
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

  it('mingo mode reports the NATS adapter object — the Mingo panel always owns a list', () => {
    const caps = capsOf({ modes: { mingo: mingoMode }, activeMode: 'mingo' }, managedRuntime);
    // Present despite the runtime endpoint, which belongs to the OTHER transport.
    expect(caps).toBeDefined();
    expect(caps?.emptyListSkipsToCompose).toBeUndefined();
  });

  it('an injected state with no capabilities falls back to the companion prop', () => {
    const injected: ChatDialogCapabilities = { canRename: true, canArchive: true, searchQuery: 'q' };
    const caps = capsOf({
      modes: {},
      activeMode: 'mingo',
      mingoStateOverride: injectedState(),
      injectedDialogCapabilities: injected,
    });
    expect(caps).toBe(injected);
  });

  it('an injected state with NEITHER still owns a list (empty, not undefined)', () => {
    // Injecting a state must never cost a host its list surface — this is the
    // case the removed `activeMode === 'mingo'` check used to carry.
    const caps = capsOf({ modes: {}, activeMode: 'mingo', mingoStateOverride: injectedState() });
    expect(caps).toEqual({});
  });

  it('capabilities ON the injected state win over the companion prop', () => {
    const own: ChatDialogCapabilities = { canRename: true };
    const caps = capsOf({
      modes: {},
      activeMode: 'mingo',
      mingoStateOverride: injectedState({ dialogCapabilities: own }),
      injectedDialogCapabilities: { canArchive: true },
    });
    expect(caps).toBe(own);
  });

  it('the companion prop is ignored when the injected state is NOT active', () => {
    const caps = capsOf({
      modes: { guide: {} },
      activeMode: 'guide',
      mingoStateOverride: injectedState(),
      injectedDialogCapabilities: { canRename: true },
    });
    expect(caps).toBeUndefined();
  });
});
