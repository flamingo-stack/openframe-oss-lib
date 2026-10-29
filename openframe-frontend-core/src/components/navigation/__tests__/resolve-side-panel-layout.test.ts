import { describe, expect, it } from 'vitest';
import { resolveSidePanelLayout, SIDE_PANEL_INSET, type SidePanelLayoutInput } from '../app-layout-side-panel';

const base: SidePanelLayoutInput = {
  rowWidth: 1224,
  isMobile: false,
  isOpen: false,
  size: { width: 296, expanded: false },
  minWidth: 296,
  minContentWidth: 400,
};

describe('resolveSidePanelLayout', () => {
  it('docks at the chosen width when both minimums fit', () => {
    const layout = resolveSidePanelLayout({ ...base, size: { width: 500, expanded: false } });
    expect(layout).toMatchObject({ mode: 'docked', width: 500, canDock: true });
    expect(layout.maxDockedWidth).toBe(1224 - 400 - SIDE_PANEL_INSET);
  });

  it('clamps a stored width to the room the content leaves', () => {
    const layout = resolveSidePanelLayout({ ...base, rowWidth: 900, size: { width: 800, expanded: false } });
    expect(layout.width).toBe(900 - 400 - SIDE_PANEL_INSET);
  });

  it('never docks narrower than its minimum', () => {
    const layout = resolveSidePanelLayout({ ...base, size: { width: 100, expanded: false } });
    expect(layout.width).toBe(296);
  });

  it('takes the whole area once dragged past the content minimum', () => {
    const layout = resolveSidePanelLayout({ ...base, size: { width: 296, expanded: true } });
    expect(layout).toMatchObject({ mode: 'full', width: 1224 - 2 * SIDE_PANEL_INSET });
  });

  it('hides without room to dock, and covers the content when opened', () => {
    const narrow = { ...base, rowWidth: 648 };
    expect(resolveSidePanelLayout(narrow)).toMatchObject({ mode: 'hidden', canDock: false });
    expect(resolveSidePanelLayout({ ...narrow, isOpen: true })).toMatchObject({ mode: 'full', canDock: false });
  });

  it('docks at exactly the room for both minimums', () => {
    const rowWidth = 400 + 296 + SIDE_PANEL_INSET;
    expect(resolveSidePanelLayout({ ...base, rowWidth }).mode).toBe('docked');
    expect(resolveSidePanelLayout({ ...base, rowWidth: rowWidth - 1 }).mode).toBe('hidden');
  });

  it('uses the overlay on a phone', () => {
    const phone = { ...base, rowWidth: 375, isMobile: true };
    expect(resolveSidePanelLayout(phone).mode).toBe('hidden');
    expect(resolveSidePanelLayout({ ...phone, isOpen: true })).toMatchObject({ mode: 'overlay', width: 375 });
  });

  it('docks before the row is measured, without an upper bound', () => {
    const layout = resolveSidePanelLayout({ ...base, rowWidth: 0, size: { width: 640, expanded: false } });
    expect(layout).toMatchObject({ mode: 'docked', width: 640, canDock: true });
    expect(layout.maxDockedWidth).toBe(Number.POSITIVE_INFINITY);
  });
});
