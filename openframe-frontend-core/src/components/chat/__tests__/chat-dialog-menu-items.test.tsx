/**
 * `chatDialogMenuItems` — the one ⋯ menu shared by every conversation surface.
 *
 * Pins the design order (link, rename, compact, archive) and that an action
 * appears only when its handler is wired, so no surface advertises something
 * the host has not implemented.
 */

import { describe, expect, it, vi } from 'vitest';

import { chatDialogMenuItems } from '../chat-dialog-menu-items';

describe('chatDialogMenuItems', () => {
  it('lists every wired action in design order, each with an icon', () => {
    const items = chatDialogMenuItems({
      onArchive: vi.fn(),
      onCompact: vi.fn(),
      onRename: vi.fn(),
      onCopyLink: vi.fn(),
    });

    expect(items.map(item => item.label)).toEqual([
      'Copy Chat Link',
      'Rename Chat',
      'Compact Chat Memory',
      'Archive Chat',
    ]);
    expect(items.every(item => item.icon)).toBe(true);
  });

  it('omits actions without a handler', () => {
    const onCompact = vi.fn();
    const items = chatDialogMenuItems({ onCompact });

    expect(items.map(item => item.id)).toEqual(['compact']);
    items[0].onClick?.();
    expect(onCompact).toHaveBeenCalledOnce();
  });
});
