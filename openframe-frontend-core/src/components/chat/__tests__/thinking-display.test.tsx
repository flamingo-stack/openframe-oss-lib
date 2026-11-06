/**
 * Thinking text goes through the shared markdown engine, which parses raw HTML: a tag name the model writes (`<div>`)
 * would be read as an element and dropped. `ThinkingDisplay` escapes it, so every chat (NATS or SSE, live or
 * reloaded) shows the thinking as written.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThinkingDisplay } from '../thinking-display';

describe('ThinkingDisplay', () => {
  it('shows an HTML tag name in the thinking as text', () => {
    render(<ThinkingDisplay text="wrap it in a <div> then" isStreaming />);
    expect(screen.getByText(/wrap it in a <div> then/)).toBeTruthy();
  });
});
