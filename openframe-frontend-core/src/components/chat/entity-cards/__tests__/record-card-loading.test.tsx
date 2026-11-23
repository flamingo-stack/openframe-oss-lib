import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatRef } from '../../chat-ref.types';
import { renderChatInlineEntityCard } from '../dispatch';

const ref = { type: 'hubspot_company', sourceRepo: 'hubspot-companies', id: '', title: 'Acme' } as ChatRef;

/**
 * A host listing a page of record cards that is still being read draws each card's loading form from the card itself
 * (`loading: true`), never a hand-built skeleton: no request is made and no link is drawn.
 */
describe('a record card has a loading form of its own', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws its skeleton with no request and no link', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<>{renderChatInlineEntityCard(ref, { loading: true })}</>);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Acme')).toBeNull();
  });

  it('draws nothing for a type the registry does not know', () => {
    const { container } = render(
      <>{renderChatInlineEntityCard({ ...ref, type: 'no_such_type' }, { loading: true })}</>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
