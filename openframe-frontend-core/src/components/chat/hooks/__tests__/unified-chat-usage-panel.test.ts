/**
 * The Usage panel a host builds (Mingo) reaches the panel through `useUnifiedChat`, which forwards the host engine's
 * state field by field: a field it does not name never reaches the composer's counter.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { ChatEngineProvider } from '../../engine/chat-engine-context';
import type { UnifiedChatState } from '../../types/unified-chat-state.types';
import type { ChatUsagePanelData } from '../../usage/chat-usage';
import { useUnifiedChat } from '../use-unified-chat';

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
  source: 'unifiedsrc',
};

function usageOf(engine: UnifiedChatState) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      createElement(
        ChatRuntimeContext.Provider,
        { value: runtime },
        createElement(ChatEngineProvider, { engine }, children),
      ),
    );
  const { result } = renderHook(() => useUnifiedChat({ modes: {}, activeMode: 'mingo' }), { wrapper });
  return result.current.usagePanel;
}

describe('useUnifiedChat — usagePanel', () => {
  it("forwards the host engine's Usage panel", () => {
    const usagePanel: ChatUsagePanelData = {
      free: { used: 1, total: 2 },
      balance: null,
      context: { used: null, limit: null, compactionThreshold: 0.8 },
      breakdown: null,
    };
    const engine = { dialogs: [], activeDialogId: null, usagePanel } as unknown as UnifiedChatState;
    expect(usageOf(engine)).toBe(usagePanel);
  });

  it('has none when the host builds none', () => {
    expect(usageOf({ dialogs: [], activeDialogId: null } as unknown as UnifiedChatState)).toBeUndefined();
  });
});
