import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FloatingTooltip } from '../floating-tooltip';

/**
 * `FloatingTooltip` opens on hover and keyboard focus by itself; a caller may also hold it open or shut (`open`), hear
 * every request to open or close it (`onOpenChange`), keep a finger's compatibility `mouseenter` from opening it
 * (`mouseOnly`) and name the bubble (`contentId`). The device picker's two-step tap uses all four (CU-17tkuw69fv1).
 */

/** The element the tooltip listens on: the trigger wrapper around the child. */
function triggerOf(child: HTMLElement): HTMLElement {
  return child.parentElement as HTMLElement;
}

function hover(child: HTMLElement, pointerType: 'mouse' | 'touch' = 'mouse') {
  fireEvent.pointerEnter(triggerOf(child), { pointerType });
  fireEvent.mouseEnter(triggerOf(child));
}

describe('FloatingTooltip', () => {
  it('is uncontrolled by default: hover opens it, leaving closes it', () => {
    render(
      <FloatingTooltip content="Save your changes">
        <button type="button">Save</button>
      </FloatingTooltip>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    hover(save);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Save your changes');
    expect(triggerOf(save)).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
    fireEvent.mouseLeave(triggerOf(save));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on a finger’s compatibility mouseenter unless mouseOnly', () => {
    const { unmount } = render(
      <FloatingTooltip content="Tip">
        <button type="button">Target</button>
      </FloatingTooltip>,
    );
    hover(screen.getByRole('button', { name: 'Target' }), 'touch');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tip');
    unmount();

    render(
      <FloatingTooltip content="Tip" mouseOnly>
        <button type="button">Target</button>
      </FloatingTooltip>,
    );
    const target = screen.getByRole('button', { name: 'Target' });
    hover(target, 'touch');
    expect(screen.queryByRole('tooltip')).toBeNull();
    // A mouse still opens it.
    hover(target, 'mouse');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tip');
  });

  it('holds open while open is true, and reports a close request without closing', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <FloatingTooltip content="Held" open onOpenChange={onOpenChange}>
        <button type="button">Target</button>
      </FloatingTooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Held');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Held');

    // Let go: the own state followed the close request, so the tooltip does not come back open.
    rerender(
      <FloatingTooltip content="Held" open={undefined} onOpenChange={onOpenChange}>
        <button type="button">Target</button>
      </FloatingTooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('holds shut while open is false, and reports the hover that asked to open it', () => {
    const onOpenChange = vi.fn();
    render(
      <FloatingTooltip content="Shut" open={false} onOpenChange={onOpenChange}>
        <button type="button">Target</button>
      </FloatingTooltip>,
    );
    hover(screen.getByRole('button', { name: 'Target' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('reports an uncontrolled change too', () => {
    const onOpenChange = vi.fn();
    render(
      <FloatingTooltip content="Tip" onOpenChange={onOpenChange}>
        <button type="button">Target</button>
      </FloatingTooltip>,
    );
    hover(screen.getByRole('button', { name: 'Target' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('gives the bubble the contentId, and the trigger’s aria-describedby names it while open', () => {
    render(
      <FloatingTooltip content="Named" open contentId="named-bubble">
        <button type="button" aria-describedby="named-bubble">
          Target
        </button>
      </FloatingTooltip>,
    );
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveAttribute('id', 'named-bubble');
    expect(triggerOf(screen.getByRole('button', { name: 'Target' }))).toHaveAttribute(
      'aria-describedby',
      'named-bubble',
    );
    expect(screen.getByRole('button', { name: 'Target' })).toHaveAccessibleDescription('Named');
  });
});
