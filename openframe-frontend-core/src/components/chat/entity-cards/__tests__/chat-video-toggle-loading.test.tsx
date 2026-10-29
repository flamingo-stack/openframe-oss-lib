import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatRef } from '../../chat-ref.types';
import { SourceActionButton } from '../../source-action-button';
import { ChatVideoToggleButton, useChatVideoToggle, WATCH_VIDEO_LABEL } from '../chat-video-toggle';

const ref = { type: 'webinar', id: 'w1', title: 'A webinar' } as ChatRef;

function Footer({ video, reserve }: { video: ChatRef | null; reserve?: boolean }) {
  const { action } = useChatVideoToggle(video, { reserve });
  return <div data-testid="row">{action}</div>;
}

describe('the card footer keeps its actions in place while loading', () => {
  it('draws "Watch video" in its loading form: the label held as a skeleton bar, not a reachable button', () => {
    render(<ChatVideoToggleButton loading />);
    expect(screen.getByText(WATCH_VIDEO_LABEL)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the slot, unseen, for a record of a video type that has no video', () => {
    render(<Footer video={null} reserve />);
    // The action is laid out (its space is kept) but cannot be reached or read.
    expect(screen.getByText(WATCH_VIDEO_LABEL)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing for a type that cannot carry a video', () => {
    render(<Footer video={null} />);
    expect(screen.getByTestId('row')).toBeEmptyDOMElement();
  });

  it('draws the live action when the record has a video', () => {
    render(<Footer video={ref} reserve />);
    expect(screen.getByRole('button', { name: `${WATCH_VIDEO_LABEL}: A webinar` })).toBeTruthy();
  });

  it('draws Ask in its loading form with the same label width', () => {
    render(<SourceActionButton chatRef={ref} onDiscuss={() => undefined} density="card" loading />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Ask')).toHaveAttribute('aria-hidden', 'true');
  });
});
