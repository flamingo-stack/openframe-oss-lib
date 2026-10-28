import { fireEvent, render, screen } from '@testing-library/react';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setEmbedAuthAdapter } from '../../../../utils/embed-authed-fetch';
import { ExternalMediaGate } from '../../../ui/markdown/external-media-gate';
import type { ChatRef } from '../../chat-ref.types';
import type { BlockCardProps } from '../block-card';
import { ChatVideoEntityCard } from '../chat-video-entity-card';
import { renderChatInlineEntityCard } from '../dispatch';

/** `[card://video:mp4-<base64url(url)>]`: the id the hub mints for an embedded video, and one a reply can mint too. */
const mp4Ref = (url: string): ChatRef =>
  ({ type: 'video', id: `mp4-${btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}` }) as ChatRef;

/** The block `chat-message-enhanced` lifts out of the `BlockCard` and draws below the paragraph. */
function blockOf(ref: ChatRef): ReactNode {
  const card = renderChatInlineEntityCard(ref);
  if (!isValidElement(card)) throw new Error('expected a BlockCard');
  return (card as ReactElement<BlockCardProps>).props.children;
}

describe('video marker — a player from outside the app waits for a click', () => {
  afterEach(() => {
    setEmbedAuthAdapter(null);
  });

  it('draws the stand-in, not the player, for a third-party mp4', () => {
    const block = blockOf(mp4Ref('https://attacker.example/v.mp4?d=secret'));
    expect(isValidElement(block) && block.type).toBe(ExternalMediaGate);
    render(<>{block}</>);
    expect(screen.getByText('attacker.example')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load video from attacker.example' })).toBeTruthy();
  });

  it('holds the player behind the click', () => {
    const block = blockOf(mp4Ref('https://attacker.example/v.mp4'));
    const { children: player } = isValidElement(block) ? (block.props as { children?: ReactNode }) : {};
    expect(isValidElement(player) && player.type).toBe(ChatVideoEntityCard);
    render(
      <ExternalMediaGate url="https://attacker.example/v.mp4" kind="video">
        <span data-testid="player" />
      </ExternalMediaGate>,
    );
    expect(screen.queryByTestId('player')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Load video from attacker.example' }));
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('mounts a video from the app itself without asking (the gateway a native shell sanctions)', () => {
    setEmbedAuthAdapter({ allowedOrigins: ['https://gateway.example'] });
    const block = blockOf(mp4Ref('https://gateway.example/media/v.mp4'));
    expect(isValidElement(block) && block.type).toBe(ChatVideoEntityCard);
  });

  it('plays Mux and YouTube markers without asking: their ids only ever reach those fixed hosts', () => {
    for (const id of ['mux-a1B2c3D4e5F6g7H8i9', 'dQw4w9WgXcQ']) {
      const block = blockOf({ type: 'video', id } as ChatRef);
      expect(isValidElement(block) && block.type, id).toBe(ChatVideoEntityCard);
    }
  });

  it('does not draw a player for a plain-http mp4 at all', () => {
    const card = renderChatInlineEntityCard(mp4Ref('http://attacker.example/v.mp4'));
    const { children } = isValidElement(card) ? (card.props as { children?: ReactNode }) : {};
    expect(isValidElement(children) && children.type === ChatVideoEntityCard).toBe(false);
    expect(isValidElement(children) && children.type === ExternalMediaGate).toBe(false);
  });
});
