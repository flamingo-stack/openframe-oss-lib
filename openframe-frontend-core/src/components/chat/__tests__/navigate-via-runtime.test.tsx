import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { useNavigateViaRuntime, useNavLinkViaRuntime } from '../nav-link-anchor-via-runtime';

function runtimeWith(navigation: Partial<ChatRuntime['navigation']>): ChatRuntime {
  return {
    endpoints: { chatStreamUrl: '/chat' },
    navigation: { mode: 'host', ...navigation },
    source: 'flamingo',
  } as ChatRuntime;
}

function wrapperFor(runtime: ChatRuntime) {
  return function RuntimeWrapper({ children }: { children: ReactNode }) {
    return <ChatRuntimeContext.Provider value={runtime}>{children}</ChatRuntimeContext.Provider>;
  };
}

describe('useNavigateViaRuntime', () => {
  it('hands a plain call to the host navigate', () => {
    const navigate = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useNavigateViaRuntime(), { wrapper: wrapperFor(runtimeWith({ navigate })) });

    result.current({ href: '/admin/jobs' });

    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/admin/jobs' }));
  });

  it('opens a new tab for a modifier click', () => {
    const navigate = vi.fn();
    const openExternal = vi.fn();
    const { result } = renderHook(() => useNavigateViaRuntime(), {
      wrapper: wrapperFor(runtimeWith({ navigate, openExternal })),
    });

    result.current({ href: '/admin/jobs', modifierEvent: { button: 0, metaKey: true } });

    expect(openExternal).toHaveBeenCalledWith('/admin/jobs');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves a middle click to the browser', () => {
    const navigate = vi.fn();
    const openExternal = vi.fn();
    const { result } = renderHook(() => useNavigateViaRuntime(), {
      wrapper: wrapperFor(runtimeWith({ navigate, openExternal })),
    });

    result.current({ href: '/admin/jobs', modifierEvent: { button: 1 } });

    expect(openExternal).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing without an href', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useNavigateViaRuntime(), { wrapper: wrapperFor(runtimeWith({ navigate })) });

    result.current({ href: null });

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('useNavLinkViaRuntime', () => {
  it.each([null, undefined, ''])('returns no link without a destination (%j)', href => {
    const { result } = renderHook(() => useNavLinkViaRuntime({ href }), { wrapper: wrapperFor(runtimeWith({})) });

    expect(result.current).toBeNull();
  });

  it('draws a new-tab link when the caller asks for one', () => {
    const { result } = renderHook(() => useNavLinkViaRuntime({ href: '/admin/preview/x', openIn: 'new-tab' }), {
      wrapper: wrapperFor(runtimeWith({})),
    });

    expect(result.current).toMatchObject({ href: '/admin/preview/x', target: '_blank' });
  });
});
