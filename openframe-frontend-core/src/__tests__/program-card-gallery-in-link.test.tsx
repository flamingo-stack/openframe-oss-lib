import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgramCard } from '../components/chat/entity-cards/program-card';
import { DEFAULT_PROGRAM_CONFIGS } from '../components/chat/entity-cards/program-card-defaults';
import type { BaseProgramItem, ProgramMedia } from '../components/chat/types/entities/program-types';

/**
 * A whole-card link puts the card's gallery inside its anchor. `stopPropagation` does not stop an anchor from
 * navigating, so a thumbnail opened the gallery and then followed the card's link. A click in the gallery is the
 * gallery's own.
 */

const item: BaseProgramItem = {
  id: 'e1',
  title: 'Miami meetup',
  description: null,
  cover_url: null,
  date: '2026-10-01T18:00:00.000Z',
};

const media: ProgramMedia[] = [
  {
    id: 'm1',
    program_id: 'e1',
    media_type: 'image',
    media_url: 'https://example.com/photo.jpg',
    display_order: 0,
    created_at: '2026-10-01T00:00:00.000Z',
  },
];

describe('ProgramCard gallery inside a whole-card link', () => {
  it('opens the gallery without following the card link', () => {
    render(
      <ProgramCard config={DEFAULT_PROGRAM_CONFIGS.event} item={item} media={media} href="/events/e1" wholeCardClickable />,
    );
    const thumb = screen.getByAltText('Miami meetup photo 1');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(thumb, event);
    expect(event.defaultPrevented).toBe(true);
  });
});
