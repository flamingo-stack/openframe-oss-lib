import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileManagerTable } from '../file-manager/file-manager-table';
import type { FileItem } from '../file-manager/types';

const FOLDERS: FileItem[] = ['Logs', 'PerfLogs', 'Program Files', 'Users', 'Windows'].map(name => ({
  id: name,
  name,
  type: 'folder',
  modified: '2026-11-04',
  path: `C:/${name}`,
}));

/** The table's own box: the element that holds the column header and the rows. */
function tableBox(): HTMLElement {
  const box = screen.getByText('NAME').parentElement?.parentElement;
  if (!box) throw new Error('no table box');
  return box;
}

describe('FileManagerTable height', () => {
  /**
   * It once sized itself to the window's bottom (`innerHeight - top`), which runs on under
   * whatever is below its parent (the docked Mingo composer): the last rows sat under it,
   * and the list could not be scrolled to them.
   */
  it('takes its parent height, never one measured from the window', () => {
    render(<FileManagerTable files={FOLDERS} selectedFiles={[]} />);
    expect(tableBox().style.height).toBe('');
    expect(tableBox()).toHaveClass('h-full');
  });

  it('keeps the same box while the folder is read', () => {
    render(<FileManagerTable files={[]} selectedFiles={[]} loading />);
    expect(tableBox()).toHaveClass('h-full');
  });

  it('scrolls its rows inside the box, under the header', () => {
    render(<FileManagerTable files={FOLDERS} selectedFiles={[]} />);
    const rows = screen.getByText('Windows').closest('.overflow-auto');
    expect(rows).not.toBeNull();
    expect(tableBox().contains(rows)).toBe(true);
  });
});
