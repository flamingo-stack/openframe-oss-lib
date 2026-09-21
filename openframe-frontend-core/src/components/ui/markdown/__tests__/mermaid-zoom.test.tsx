/**
 * The zoom toolbar lives in the ONE MermaidDiagram, so every diagram (a
 * markdown fence, a server-rendered admin chart) zooms the same way. Pins:
 * the buttons change the container's CSS `zoom`, the bounds hold, reset
 * returns to 100%, and `zoomable={false}` renders no toolbar.
 */
import { render, act, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renders: Array<{ resolve: (value: { svg: string }) => void }> = [];

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(
      () =>
        new Promise<{ svg: string }>(resolve => {
          renders.push({ resolve });
        }),
    ),
  },
}));

import { MERMAID_ZOOM_MAX, MERMAID_ZOOM_MIN, MermaidDiagram } from '../mermaid-diagram';

const flushUntil = async (done: () => boolean, what: string) => {
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    if (done()) return;
  }
  throw new Error(`timed out waiting for ${what}`);
};

const mountRendered = async (props: { zoomable?: boolean } = {}) => {
  render(<MermaidDiagram chart="flowchart LR; a-->b" {...props} />);
  await flushUntil(() => renders.length >= 1, 'a mermaid.render call');
  await act(async () => {
    renders[0].resolve({ svg: '<svg width="10" height="10"><g/></svg>' });
  });
  await flushUntil(() => !!screen.queryByTestId('mermaid-svg-container'), 'the rendered diagram');
};

const zoomOf = () => Number(screen.getByTestId('mermaid-svg-container').getAttribute('data-zoom'));

describe('MermaidDiagram zoom', () => {
  beforeEach(() => {
    renders.length = 0;
  });

  it('zooms in and out from the toolbar and resets to 100%', async () => {
    await mountRendered();
    expect(zoomOf()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomOf()).toBe(1.25);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomOf()).toBeCloseTo(1.56, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(zoomOf()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomOf()).toBe(0.8);
  });

  it('stays inside the bounds and disables the button at each end', async () => {
    await mountRendered();
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 20; i++) fireEvent.click(zoomIn);
    expect(zoomOf()).toBe(MERMAID_ZOOM_MAX);
    expect(zoomIn).toBeDisabled();
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 40; i++) fireEvent.click(zoomOut);
    expect(zoomOf()).toBe(MERMAID_ZOOM_MIN);
    expect(zoomOut).toBeDisabled();
  });

  it('holds the skeleton for an empty chart instead of asking mermaid to parse it', async () => {
    const { rerender } = render(<MermaidDiagram chart="" frame="fold" />);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(renders).toHaveLength(0);
    expect(screen.getByTestId('mermaid-frame').getAttribute('data-frame')).toBe('fold');
    expect(screen.queryByTestId('mermaid-svg-container')).toBeNull();
    rerender(<MermaidDiagram chart="flowchart LR; a-->b" frame="fold" />);
    await flushUntil(() => renders.length >= 1, 'the first real render');
  });

  it('pans by dragging the frame, and zooms from the keyboard and a ⌘/Ctrl wheel', async () => {
    await mountRendered();
    const frame = screen.getByTestId('mermaid-frame');
    fireEvent.pointerDown(frame, { button: 0, pointerType: 'mouse', clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(frame, { clientX: 60, clientY: 75, pointerId: 1 });
    expect(frame.scrollLeft).toBe(40);
    expect(frame.scrollTop).toBe(25);
    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.pointerMove(frame, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(frame.scrollLeft).toBe(40);

    fireEvent.keyDown(frame, { key: '+' });
    expect(zoomOf()).toBe(1.25);
    fireEvent.keyDown(frame, { key: '0' });
    expect(zoomOf()).toBe(1);
    fireEvent.wheel(frame, { deltaY: -400, ctrlKey: true, clientX: 10, clientY: 10 });
    expect(zoomOf()).toBeGreaterThan(1);
    fireEvent.wheel(frame, { deltaY: 400 });
    expect(zoomOf()).toBeGreaterThan(1); // a plain wheel scrolls, it never zooms
  });

  it('renders no toolbar when zoom is turned off', async () => {
    await mountRendered({ zoomable: false });
    expect(screen.queryByRole('group', { name: 'Diagram zoom' })).toBeNull();
    expect(zoomOf()).toBe(1);
  });
});
