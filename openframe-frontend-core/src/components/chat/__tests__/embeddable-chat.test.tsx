import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const heard: Array<{ type: string; detail: unknown }> = [];
let panelMounts = 0;

vi.mock('../../../contexts/chat-runtime-context', () => ({
  useRequiredChatRuntime: () => ({ source: 'flamingo' }),
}));

// The panel, reduced to what the shell relies on: it listens for the open events once mounted, and has a handle.
let panelBaseRoute: string | undefined;
const commands: unknown[] = [];
vi.mock('../embeddable-chat-panel', async () => {
  const { forwardRef, useEffect: onMount, useImperativeHandle } = await import('react');
  return {
    EmbeddableChatPanel: forwardRef<EmbeddableChatHandle, { baseRoute?: string }>(function Panel({ baseRoute }, ref) {
      panelBaseRoute = baseRoute;
      useImperativeHandle(ref, () => ({
        startNewChat: () => commands.push('new chat'),
        prefillDraft: draft => commands.push(draft),
      }));
      onMount(() => {
        panelMounts += 1;
        const onOpen = (event: Event) => heard.push({ type: event.type, detail: (event as CustomEvent).detail });
        window.addEventListener('ask-ai:open', onOpen);
        window.addEventListener('ask-ai:open-with-ref', onOpen);
        return () => {
          window.removeEventListener('ask-ai:open', onOpen);
          window.removeEventListener('ask-ai:open-with-ref', onOpen);
        };
      }, []);
      return <div data-testid="panel" />;
    }),
  };
});

import { EmbeddableChat, type EmbeddableChatHandle } from '../embeddable-chat';

const open = (type: string, detail: unknown) =>
  act(async () => {
    window.dispatchEvent(new CustomEvent(type, { detail }));
    // Let the panel's module and the host's deferred props resolve inside this act.
    await Promise.resolve();
  });

describe('EmbeddableChat', () => {
  beforeEach(() => {
    heard.length = 0;
    commands.length = 0;
    panelMounts = 0;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('draws nothing and loads no panel until the chat is asked for', () => {
    render(<EmbeddableChat showInternalTrigger={false} />);
    expect(screen.queryByTestId('panel')).toBeNull();
    expect(panelMounts).toBe(0);
  });

  it('loads the panel on the first open and hands it that open, question included', async () => {
    render(<EmbeddableChat showInternalTrigger={false} />);
    await open('ask-ai:open', { source: 'flamingo', prompt: 'What does it cost?' });
    expect(await screen.findByTestId('panel')).toBeTruthy();
    await expect.poll(() => heard.length).toBe(1);
    expect(heard[0]).toEqual({ type: 'ask-ai:open', detail: { source: 'flamingo', prompt: 'What does it cost?' } });
  });

  it('does the same for an open that carries a record', async () => {
    render(<EmbeddableChat showInternalTrigger={false} />);
    const detail = { source: 'flamingo', ref: { type: 'faq', id: '7', title: 'Pricing', url: null } };
    await open('ask-ai:open-with-ref', detail);
    await screen.findByTestId('panel');
    await expect.poll(() => heard.length).toBe(1);
    expect(heard[0]).toEqual({ type: 'ask-ai:open-with-ref', detail });
  });

  it('ignores an open addressed to another chat', async () => {
    render(<EmbeddableChat showInternalTrigger={false} />);
    await open('ask-ai:open', { source: 'openmsp' });
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  it('hands over each later open once: the panel hears it itself', async () => {
    render(<EmbeddableChat showInternalTrigger={false} />);
    await open('ask-ai:open', { source: 'flamingo' });
    await screen.findByTestId('panel');
    await expect.poll(() => heard.length).toBe(1);
    await open('ask-ai:open', { source: 'flamingo', prompt: 'Again' });
    expect(heard).toHaveLength(2);
    expect(panelMounts).toBe(1);
  });

  it('mounts the panel at once for a host that asks for it open', async () => {
    render(<EmbeddableChat showInternalTrigger={false} defaultOpen />);
    expect(await screen.findByTestId('panel')).toBeTruthy();
    expect(heard).toHaveLength(0);
  });

  it('mounts the panel at once for a host that draws it in its own surface, as a visual, or with its own trigger', async () => {
    for (const ui of [
      <EmbeddableChat key="shell" showInternalTrigger={false} shell="none" />,
      <EmbeddableChat key="preview" showInternalTrigger={false} previewMode />,
      <EmbeddableChat key="trigger" />,
    ]) {
      const view = render(ui);
      expect(await screen.findByTestId('panel')).toBeTruthy();
      view.unmount();
    }
    expect(heard).toHaveLength(0);
  });

  it("runs a host's command on the panel, loading it first when it is not there yet", async () => {
    const handle = createRef<EmbeddableChatHandle>();
    render(<EmbeddableChat ref={handle} showInternalTrigger={false} />);
    expect(screen.queryByTestId('panel')).toBeNull();
    await act(async () => {
      handle.current?.prefillDraft({ text: 'Fix it' });
      await Promise.resolve();
    });
    await screen.findByTestId('panel');
    await expect.poll(() => commands).toEqual([{ text: 'Fix it' }]);
    act(() => handle.current?.startNewChat());
    expect(commands).toEqual([{ text: 'Fix it' }, 'new chat']);
    expect(panelMounts).toBe(1);
  });

  it("loads a host's deferred props with the panel, once, and merges them over the direct ones", async () => {
    const panelProps = vi.fn(() => Promise.resolve({ baseRoute: '/docs' }));
    render(<EmbeddableChat showInternalTrigger={false} baseRoute="/knowledge-base" panelProps={panelProps} />);
    expect(panelProps).not.toHaveBeenCalled();
    await open('ask-ai:open', { source: 'flamingo' });
    await screen.findByTestId('panel');
    expect(panelProps).toHaveBeenCalledTimes(1);
    expect(panelBaseRoute).toBe('/docs');
  });
});
