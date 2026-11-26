import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEVICE_SELECTOR, IdleIntersectionObserver } from '../../feature-tables.fixtures';
import { DeviceSelector } from './device-selector';

/**
 * The picker's grid pins its Device column by the rule every grid table follows: on a desktop with room for it, and
 * not in a narrow content column (the Mingo panel docked), on a tablet or a phone. Its add / remove column stays pinned
 * right at every width, so the button's tooltip names the device a scrolled row adds (CU-17tkuw69fv1).
 */

/** The classes of the Device column's body cells. */
function deviceCells(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-grid-col="device"]')]
    .filter(cell => !cell.hasAttribute('data-grid-header-cell'))
    .map(cell => cell.className);
}

/** Moves keyboard focus onto the control (the tooltip opens on focus, as on hover) and returns the tooltip it opens. */
function focusTooltip(control: HTMLElement): Promise<HTMLElement> {
  fireEvent.focusIn(control);
  return screen.findByRole('tooltip');
}

describe('DeviceSelector grid', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  it('pins the Device column by the shared rule, beside the add column pinned at every width', () => {
    const { container } = render(<DeviceSelector {...DEVICE_SELECTOR.loaded} layout="grid" />);
    const cells = deviceCells(container);
    expect(cells).toHaveLength(DEVICE_SELECTOR.loaded.devices.length);
    for (const cell of cells) {
      expect(cell.split(' ')).toContain('lg:content-md:sticky');
      expect(cell.split(' ')).not.toContain('lg:sticky');
    }
  });

  it('names the device in the add button’s tooltip', async () => {
    render(<DeviceSelector {...DEVICE_SELECTOR.loaded} layout="grid" />);
    const add = screen.getByRole('button', { name: 'Add reception-01' });
    expect(await focusTooltip(add)).toHaveTextContent('Add reception-01');
  });

  it('names the device before the reason a disabled row cannot be added', async () => {
    render(
      <DeviceSelector
        {...DEVICE_SELECTOR.loaded}
        layout="grid"
        isDeviceDisabled={device => (device.id === 'd-2' ? 'Already in this policy' : undefined)}
      />,
    );
    const blocked = screen.getByLabelText('Add maya-mba: Already in this policy');
    expect(await focusTooltip(blocked)).toHaveTextContent('Add maya-mba: Already in this policy');
  });
});
