/**
 * An ordered list keeps the number its source opens on.
 *
 * The renderer is routinely handed a PIECE of a document rather than the whole:
 * the streaming block splitter cuts at block boundaries, and the chat bubble
 * cuts at every hoisted card. A piece that opens mid-list starts with `2.`,
 * and the `ol` override used to drop the `start` attribute that says so — so
 * every piece renumbered itself "1.". Asserted on the DOM, because the text
 * content of a list is identical either way and cannot catch it.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SimpleMarkdownRenderer } from '../index';

describe('SimpleMarkdownRenderer — ordered list start', () => {
  it('keeps the start of a list that does not open on 1', () => {
    render(<SimpleMarkdownRenderer content={'2. second\n3. third'} />);

    expect(screen.getByRole('list')).toHaveAttribute('start', '2');
  });

  it('leaves a list that opens on 1 without a start attribute', () => {
    render(<SimpleMarkdownRenderer content={'1. first\n2. second'} />);

    expect(screen.getByRole('list')).not.toHaveAttribute('start');
  });
});
