/**
 * The loading states hosts draw while a section reads its data: each is the
 * loaded component's own box, and the walkthrough card's file-over-YouTube rule.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FaqAccordionSkeleton } from '../../faq-accordion';
import { ConversationCardSkeleton } from '../conversation-card';
import { playsYouTube } from '../walkthrough-video';

describe('playsYouTube', () => {
  it('plays the stored file when the video has both', () => {
    expect(playsYouTube({ mainVideoUrl: 'https://cdn/x.m3u8', youtubeUrl: 'https://youtu.be/x' })).toBe(false);
  });
  it('plays YouTube only when there is no stored file', () => {
    expect(playsYouTube({ youtubeUrl: 'https://youtu.be/x' })).toBe(true);
    expect(playsYouTube(null)).toBe(false);
  });
});

describe('FaqAccordionSkeleton', () => {
  it('announces itself as loading', () => {
    render(<FaqAccordionSkeleton rows={3} />);
    expect(screen.getByText('Loading questions')).toBeInTheDocument();
  });
});

describe('ConversationCardSkeleton', () => {
  it('renders with or without its optional parts and announces itself as loading', () => {
    const { rerender } = render(<ConversationCardSkeleton avatarPx={32} />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    rerender(<ConversationCardSkeleton avatarPx={32} context footer />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});
