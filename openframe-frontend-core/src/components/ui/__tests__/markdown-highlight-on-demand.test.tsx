import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownEngine } from '../markdown/engine';

/** The highlighter is fetched when a text has code to colour, and the block is drawn either way. */
describe('code highlighting loads on demand', () => {
  it('draws a labelled code block at once, then colours it when the highlighter lands', async () => {
    render(
      <div data-testid="md">
        <MarkdownEngine content={'```ts\nconst answer: number = 42;\n```'} />
      </div>,
    );
    const md = screen.getByTestId('md');
    expect(md.textContent).toContain('const answer: number = 42;');
    await expect.poll(() => md.innerHTML, { timeout: 5000 }).toContain('hljs-');
  });

  it('never colours text that has no code in it', () => {
    render(
      <div data-testid="plain">
        <MarkdownEngine content="Just a sentence with **bold** text." />
      </div>,
    );
    expect(screen.getByTestId('plain').innerHTML).not.toContain('hljs');
  });
});
