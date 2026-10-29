import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MingoQuickActionWall } from '../mingo-quick-action-wall';
import { MingoWelcome } from '../mingo-welcome';

const ACTIONS = [
  { id: 'qa-1', label: 'Patching', prompt: 'Check my fleet for pending patches.', onClick: vi.fn() },
  { id: 'qa-2', label: 'Disk Scan', prompt: 'Run a quick disk scan.', onClick: vi.fn() },
];

describe('MingoQuickActionWall', () => {
  it('sends a chip and reports hover, as the welcome does', () => {
    const onQuickActionHover = vi.fn();
    const onQuickActionHoverEnd = vi.fn();
    render(
      <MingoQuickActionWall
        quickActions={ACTIONS}
        onQuickActionHover={onQuickActionHover}
        onQuickActionHoverEnd={onQuickActionHoverEnd}
      />,
    );
    const chip = screen.getAllByRole('button', { name: 'Patching' })[0];
    fireEvent.focus(chip);
    expect(onQuickActionHover).toHaveBeenCalledWith(ACTIONS[0]);
    fireEvent.blur(chip);
    expect(onQuickActionHoverEnd).toHaveBeenCalled();
    fireEvent.click(chip);
    expect(ACTIONS[0].onClick).toHaveBeenCalledTimes(1);
  });

  it('draws nothing without actions', () => {
    const { container } = render(<MingoQuickActionWall quickActions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("holds the wall's place while the actions are read: its chips' loading form, no chip to press", () => {
    const { container } = render(<MingoQuickActionWall quickActions={[]} loading />);
    expect(container.innerHTML).toContain('data-loading-item');
    expect(container.innerHTML).toContain('max-h-44');
    expect(screen.queryAllByRole('button', { name: 'Patching' })).toHaveLength(0);
  });

  it('is the wall the welcome draws', () => {
    const { container: welcome } = render(<MingoWelcome quickActions={ACTIONS} hasExistingChats={false} />);
    const { container: wall } = render(<MingoQuickActionWall quickActions={ACTIONS} />);
    expect(wall.innerHTML).toContain('max-h-44');
    expect(welcome.innerHTML).toContain(wall.innerHTML);
  });
});
