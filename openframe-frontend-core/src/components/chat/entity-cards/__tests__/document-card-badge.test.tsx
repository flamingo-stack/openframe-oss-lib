import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSourceLabel } from '../../../../utils/source-icons';
import { CHAT_CARD_REGISTRY } from '../dispatch';

describe('a document card whose row names no table', () => {
  it('reads its badge from the table the ref derived', () => {
    const chatRef = {
      type: 'data_room_doc',
      id: 'deck',
      sourceRepo: 'data-room-docs',
      title: 'Deck',
      url: 'https://company-hub.flamingo.so/data-room/deck',
    };
    const row = { id: 'deck', title: 'Deck', url: 'https://company-hub.flamingo.so/data-room/deck' };
    render(
      <>
        {CHAT_CARD_REGISTRY.data_room_doc.render?.(row, chatRef as never, { isNewTab: false, actions: {} } as never)}
      </>,
    );
    expect(screen.getByText(getSourceLabel('data-room-docs'))).toBeTruthy();
    expect(screen.queryByText('Document')).toBeNull();
  });
});
