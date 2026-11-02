/**
 * `edgeLight`: Mingo's AI edge light (the header launcher's travelling arc) on
 * the composer's input card. Off by default, and never on an archived chat,
 * which has no input to draw it around.
 */

import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { ChatComposer, type ChatComposerProps } from '../chat-composer';
import type { ChatInputRef } from '../types/component.types';

function renderComposer(props: Partial<ChatComposerProps> = {}) {
  return render(
    <ChatComposer
      inputRef={createRef<ChatInputRef>()}
      onSend={() => {}}
      onStop={() => {}}
      sending={false}
      placeholder="Ask Mingo"
      {...props}
    />,
  );
}

describe('ChatComposer edge light', () => {
  it('draws no edge light by default', () => {
    renderComposer();
    expect(screen.queryByTestId('mingo-edge-light')).toBeNull();
  });

  it("lights the input card's edge, rounded like the card", () => {
    renderComposer({ edgeLight: true, contextPicker: { entityTypes: [], renderItems: () => null } });
    const light = screen.getByTestId('mingo-edge-light');
    expect(light).toHaveClass('mingo-edge-frame', 'rounded-md');
  });

  it('draws none on an archived chat', () => {
    renderComposer({ edgeLight: true, archived: true });
    expect(screen.queryByTestId('mingo-edge-light')).toBeNull();
  });
});
