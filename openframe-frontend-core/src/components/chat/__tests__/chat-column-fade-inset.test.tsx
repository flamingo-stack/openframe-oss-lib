/**
 * The three-column shell's chat column: the thread fades out into the composer under it
 * (`ChatMessageList` `fadeEnd`), and the composer drops its side inset in a narrow column
 * (`ChatComposer` `inset="wide"`).
 */

import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { ChatComposer } from '../chat-composer';
import { CHAT_THREAD_FADE_PX, ChatMessageList } from '../chat-message-list';
import type { ChatInputRef } from '../types/component.types';

const composer = (inset?: 'always' | 'wide') => (
  <ChatComposer
    inputRef={createRef<ChatInputRef>()}
    onSend={() => {}}
    onStop={() => {}}
    sending={false}
    placeholder="Ask Mingo"
    inset={inset}
  />
);

/** The composer's own box: its first element. */
const composerBox = () => /^<div class="([^"]*)"/.exec(document.body.firstElementChild?.innerHTML ?? '')?.[1] ?? '';

describe('ChatComposer inset', () => {
  it('insets the composer always by default', () => {
    render(composer());
    expect(composerBox()).toContain('px-[var(--spacing-system-m)]');
    expect(composerBox()).not.toContain('content-md:');
  });

  it('insets it from the content md step only with "wide"', () => {
    render(composer('wide'));
    expect(composerBox()).toContain('px-0');
    expect(composerBox()).toContain('content-md:px-[var(--spacing-system-m)]');
  });
});

describe('ChatMessageList fadeEnd', () => {
  const message = { id: 'm1', role: 'user' as const, content: 'hello', name: 'Ada', timestamp: new Date() };

  it('masks the scroller end and pads the content past it', () => {
    render(<ChatMessageList messages={[message]} fadeEnd />);
    const html = document.body.innerHTML;
    expect(html).toContain(`mask-image: linear-gradient(to bottom, black calc(100% - ${CHAT_THREAD_FADE_PX}px)`);
    expect(html).toContain(`padding-bottom: ${CHAT_THREAD_FADE_PX}px`);
  });

  it('draws no fade by default', () => {
    render(<ChatMessageList messages={[message]} />);
    expect(document.body.innerHTML).not.toContain('mask-image');
  });
});
