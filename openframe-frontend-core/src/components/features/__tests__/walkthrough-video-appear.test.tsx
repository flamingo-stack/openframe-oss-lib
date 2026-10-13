/**
 * When the walkthrough card appears.
 *
 * The FLOATING card is a late, uninvited overlay: it waits for its appear delay
 * AND the visitor's first scroll, tap or key press. Largest Contentful Paint
 * takes candidates until that first interaction, so a card shown on a timer
 * alone could become the page's LCP. The inline block is page content and
 * waits for neither.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FloatingWalkthroughVideo, InlineWalkthroughVideo } from '../walkthrough-video';

vi.mock('../video', () => ({ Video: () => <div data-testid="player" /> }));

const VIDEO = { id: 'v1', mainVideoUrl: 'https://example.com/a.m3u8', posterUrl: null, title: 'Demo' };
const CARD = { name: /Play Demo Video/ };
const DELAY_MS = 3000;

/** Let the delay pass and any idle callback run. */
const passTime = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('walkthrough-video: when the card appears', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('the floating card does not appear on the delay alone', () => {
    render(<FloatingWalkthroughVideo video={VIDEO} dismissal={false} appearDelayMs={DELAY_MS} />);
    passTime(DELAY_MS * 10);
    expect(screen.queryByRole('button', CARD)).toBeNull();
  });

  it.each(['scroll', 'pointerDown', 'keyDown'] as const)(
    'the floating card appears after the delay once the visitor interacts (%s)',
    interaction => {
      render(<FloatingWalkthroughVideo video={VIDEO} dismissal={false} appearDelayMs={DELAY_MS} />);
      passTime(DELAY_MS);
      fireEvent[interaction](window);
      passTime(100);
      expect(screen.getByRole('button', CARD)).toBeTruthy();
    },
  );

  it('an interaction before the delay still waits for the delay', () => {
    render(<FloatingWalkthroughVideo video={VIDEO} dismissal={false} appearDelayMs={DELAY_MS} />);
    fireEvent.scroll(window);
    passTime(DELAY_MS - 1);
    expect(screen.queryByRole('button', CARD)).toBeNull();
    passTime(100);
    expect(screen.getByRole('button', CARD)).toBeTruthy();
  });

  it('the inline block appears with no interaction', () => {
    render(<InlineWalkthroughVideo video={VIDEO} />);
    passTime(100);
    expect(screen.getByRole('button', CARD)).toBeTruthy();
  });
});
