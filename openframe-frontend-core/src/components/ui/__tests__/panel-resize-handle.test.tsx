import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PanelResizeGrip, PanelResizeHandle } from '../panel-resize-handle';

const clamp = (size: number) => Math.min(480, Math.max(200, size));

function renderHandle(overrides: Partial<Parameters<typeof PanelResizeHandle>[0]> = {}) {
  const onSize = vi.fn();
  const onDrag = vi.fn();
  const onReset = vi.fn();
  render(
    <PanelResizeHandle
      side="left"
      variant="inLayout"
      size={264}
      minSize={200}
      maxSize={480}
      clampSize={clamp}
      onSize={onSize}
      onDrag={onDrag}
      onReset={onReset}
      ariaLabel="Resize test panel"
      grip={<PanelResizeGrip />}
      {...overrides}
    />,
  );
  const handle = screen.getByRole('separator', { name: 'Resize test panel' });
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
  return { handle, onSize, onDrag, onReset };
}

describe('PanelResizeHandle', () => {
  it('names itself and its range', () => {
    const { handle } = renderHandle();
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuenow', '264');
    expect(handle).toHaveAttribute('aria-valuemin', '200');
    expect(handle).toHaveAttribute('aria-valuemax', '480');
  });

  it('a drag hands every move to onDrag, clamped, and commits the size once on release', () => {
    const { handle, onSize, onDrag } = renderHandle();
    fireEvent.pointerDown(handle, { button: 0, clientX: 264, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });
    expect(onDrag).toHaveBeenLastCalledWith(300);
    expect(handle).toHaveAttribute('aria-valuenow', '300');
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    expect(onDrag).toHaveBeenLastCalledWith(480);
    expect(onSize).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { clientX: 900, pointerId: 1 });
    expect(onSize).toHaveBeenCalledTimes(1);
    expect(onSize).toHaveBeenCalledWith(480);
  });

  it('without onDrag a drag writes the panel its width', () => {
    const panelRef = createRef<HTMLDivElement>();
    render(<div ref={panelRef} />);
    const { handle, onSize } = renderHandle({ onDrag: undefined, panelRef });
    fireEvent.pointerDown(handle, { button: 0, clientX: 264, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, pointerId: 1 });
    expect(panelRef.current?.style.width).toBe('230px');
    fireEvent.pointerUp(handle, { clientX: 230, pointerId: 1 });
    expect(onSize).toHaveBeenCalledWith(230);
  });

  it('steps by the keyboard: 16px, 40px with Shift, Home and End to the bounds', () => {
    const { handle, onSize } = renderHandle();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onSize).toHaveBeenLastCalledWith(280);
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onSize).toHaveBeenLastCalledWith(224);
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(onSize).toHaveBeenLastCalledWith(200);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(onSize).toHaveBeenLastCalledWith(480);
  });

  it('a panel on the right grows towards the left', () => {
    const { handle, onSize } = renderHandle({ side: 'right' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onSize).toHaveBeenLastCalledWith(280);
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 450, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 450, pointerId: 1 });
    expect(onSize).toHaveBeenLastCalledWith(314);
  });

  it('a double click asks for the default', () => {
    const { handle, onReset } = renderHandle();
    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('PanelResizeGrip', () => {
  it("draws the design's pill with the three-line mark, hidden from readers", () => {
    const { handle } = renderHandle();
    // Decorative: no role, no text, so it is read off the handle's markup.
    expect(handle).toContainHTML('aria-hidden');
    expect(handle).toContainHTML('h-8 w-4');
    expect(handle).toContainHTML('rounded-sm border border-ods-border bg-ods-bg');
    expect(handle).toContainHTML('<svg');
  });
});
