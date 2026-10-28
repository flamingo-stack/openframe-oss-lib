import { fireEvent, render, screen } from '@testing-library/react';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setEmbedAuthAdapter } from '../../../../utils/embed-authed-fetch';
import { ExternalMediaNotice } from '../../../ui/markdown/external-media-notice';
import type { ChatRef } from '../../chat-ref.types';
import type { BlockCardProps } from '../block-card';
import { ChatCollapsibleVideo, HIDE_VIDEO_LABEL, WATCH_VIDEO_LABEL } from '../chat-video-toggle';
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

describe('video marker — a player from outside the app is not drawn', () => {
  afterEach(() => {
    setEmbedAuthAdapter(null);
  });

  it('draws a notice, and no player, for a third-party mp4', () => {
    const block = blockOf(mp4Ref('https://attacker.example/v.mp4?d=secret'));
    expect(isValidElement(block) && block.type).toBe(ExternalMediaNotice);
    // The player is not in the tree at all, not merely hidden: it would fetch on mount.
    const { children } = isValidElement(block) ? (block.props as { children?: ReactNode }) : {};
    expect(children).toBeUndefined();
    render(<>{block}</>);
    expect(screen.getByText('attacker.example')).toBeTruthy();
    expect(screen.getByText(/Videos from other sites are blocked for your privacy\./)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('mounts a video from the app itself (the gateway a native shell sanctions)', () => {
    setEmbedAuthAdapter({ allowedOrigins: ['https://gateway.example'] });
    const block = blockOf(mp4Ref('https://gateway.example/media/v.mp4'));
    expect(isValidElement(block) && block.type).toBe(ChatCollapsibleVideo);
  });

  it('plays Mux and YouTube markers: their ids only ever reach those fixed hosts', () => {
    for (const id of ['mux-a1B2c3D4e5F6g7H8i9', 'dQw4w9WgXcQ']) {
      const block = blockOf({ type: 'video', id } as ChatRef);
      expect(isValidElement(block) && block.type, id).toBe(ChatCollapsibleVideo);
    }
  });

  it('does not draw a player for a plain-http mp4 at all', () => {
    const card = renderChatInlineEntityCard(mp4Ref('http://attacker.example/v.mp4'));
    const { children } = isValidElement(card) ? (card.props as { children?: ReactNode }) : {};
    expect(isValidElement(children) && children.type === ChatCollapsibleVideo).toBe(false);
    expect(isValidElement(children) && children.type === ExternalMediaNotice).toBe(false);
  });
});

/**
 * The player opens from its card, never on its own: drawn when the answer loads,
 * every recording grew the answer by a 16:9 box while it was being read
 * (CU-17tkuw61kfy).
 */
describe('video marker — collapsed until the reader opens it', () => {
  it('draws one action row and no player, then the player once opened, and closes again', () => {
    const block = blockOf({ type: 'video', id: 'mux-a1B2c3D4e5F6g7H8i9', title: 'Onboarding walkthrough' } as ChatRef);
    const { container } = render(<>{block}</>);
    const open = screen.getByRole('button', { name: `${WATCH_VIDEO_LABEL}: Onboarding walkthrough` });
    expect(open.getAttribute('aria-expanded')).toBe('false');
    const before = container.innerHTML;

    fireEvent.click(open);
    const close = screen.getByRole('button', { name: `${HIDE_VIDEO_LABEL}: Onboarding walkthrough` });
    expect(close.getAttribute('aria-expanded')).toBe('true');
    expect(container.innerHTML).not.toBe(before);

    fireEvent.click(close);
    expect(screen.getByRole('button', { name: `${WATCH_VIDEO_LABEL}: Onboarding walkthrough` })).toBeTruthy();
    expect(container.innerHTML).toBe(before);
  });
});
