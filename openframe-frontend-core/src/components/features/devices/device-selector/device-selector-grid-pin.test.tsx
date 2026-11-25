import { render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEVICE_SELECTOR, IdleIntersectionObserver } from '../../feature-tables.fixtures';
import { DeviceSelector } from './device-selector';

/**
 * The picker's grid pins its Device column on every desktop window, also in a narrow content column (the Mingo panel
 * docked), because its add / remove column is pinned right at every width and a row with no name beside the plus says
 * nothing (CU-17tkuw69fv1). A tablet and a phone keep the shared rule: the column scrolls. Without the add column
 * (criteria mode) the picker is an ordinary table and keeps the shared rule everywhere.
 */

/** The opening tag of the first element carrying `marker`. */
function openingTag(container: HTMLElement, marker: string): string {
  return new RegExp(`<[a-z]+[^>]*${marker}[^>]*>`).exec(container.innerHTML)?.[0] ?? '';
}

/** The classes of the Device column's body cells. */
function deviceCells(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-grid-col="device"]')]
    .filter(cell => !cell.hasAttribute('data-grid-header-cell'))
    .map(cell => cell.className);
}

describe('DeviceSelector grid: the Device column pin', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  it('pins the Device column on a desktop window whatever the content width, beside the pinned add column', () => {
    const { container } = render(<DeviceSelector {...DEVICE_SELECTOR.loaded} layout="grid" />);
    const cells = deviceCells(container);
    expect(cells).toHaveLength(DEVICE_SELECTOR.loaded.devices.length);
    for (const cell of cells) {
      expect(cell.split(' ')).toContain('lg:sticky');
      expect(cell).not.toContain('content-md:');
    }
    expect(openingTag(container, 'data-grid-root')).toMatch(/ lg:\[--dt-pin-l:var\(--dt-pin-l-wide\)\]/);
  });

  it('keeps the shared rule in criteria mode, where there is no add column to stay beside', () => {
    const { container } = render(
      <DeviceSelector {...DEVICE_SELECTOR.loaded} layout="grid" selectionMode="criteria" criteriaContent={null} />,
    );
    const cells = deviceCells(container);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.split(' ')).toContain('lg:content-md:sticky');
      expect(cell.split(' ')).not.toContain('lg:sticky');
    }
  });

  it('leaves the card rows alone', () => {
    const { container } = render(<DeviceSelector {...DEVICE_SELECTOR.loaded} layout="cards" />);
    expect(container.innerHTML).not.toContain('data-grid-root');
    expect(container.innerHTML).not.toContain('lg:sticky');
  });
});
