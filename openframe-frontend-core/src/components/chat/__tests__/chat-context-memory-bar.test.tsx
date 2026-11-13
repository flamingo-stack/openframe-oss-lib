/**
 * `ChatContextMemoryBar`'s ground: Figma's backgrounds/openframe-background (`bg-ods-bg-base`),
 * never the page's `bg-ods-bg`, which Mingo's `data-surface="mingo"` tints cyan.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatContextMemoryBar } from '../chat-context-memory-bar';

const DEVICE = { type: 'DEVICE', id: 'd-1', label: 'Laptop' };

describe('ChatContextMemoryBar - ground', () => {
  it('draws the strip on the untinted base ground, inside the Mingo surface too', () => {
    render(
      <div data-surface="mingo">
        <ChatContextMemoryBar items={[DEVICE]} />
      </div>,
    );

    expect(screen.getByText(/1 recently viewed item in context/)).toBeInTheDocument();
    const strip = screen.getByTestId('chat-context-memory-strip');
    expect(strip).toHaveClass('bg-ods-bg-base');
    expect(strip).not.toHaveClass('bg-ods-bg');
  });

  it('keeps the same ground in its loading form', () => {
    render(<ChatContextMemoryBar items={[]} pending />);

    const strip = screen.getByTestId('chat-context-memory-strip');
    expect(strip).toHaveClass('bg-ods-bg-base');
    expect(strip).not.toHaveClass('bg-ods-bg');
  });
});
