import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PermissionCategory } from '../../../types/permissions';
import { PolicyConfigurationPanel } from '../policy-configuration-panel';

const categories: PermissionCategory[] = [
  {
    id: 'downloads',
    name: 'File Downloads',
    policies: [
      {
        id: 'web',
        naturalKey: 'web',
        name: 'Download files from web',
        commandPattern: '(?i)^(Invoke-WebRequest|wget|curl).*',
        toolName: 'OPENFRAME',
        approvalLevel: 'ASK_USER',
      },
    ],
  },
];

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

describe('PolicyConfigurationPanel', () => {
  it("shows a rule's level with its icon in its colour, and its pattern on one line", () => {
    render(
      <PolicyConfigurationPanel
        categories={categories}
        editMode={false}
        onPolicyPermissionChange={() => {}}
        onCategoryPermissionChange={() => {}}
      />,
    );
    open();
    const [level] = screen.getAllByText('Ask User');
    expect(level?.className).toContain('text-h4');
    expect((level?.previousElementSibling as HTMLElement).className).toContain('text-ods-warning');
    const pattern = screen.getByTitle('(?i)^(Invoke-WebRequest|wget|curl).*');
    expect(pattern.className).toContain('truncate');
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull();
  });

  it("centres a rule's level on its row and greys its tool icon", () => {
    render(
      <PolicyConfigurationPanel
        categories={categories}
        editMode={false}
        onPolicyPermissionChange={() => {}}
        onCategoryPermissionChange={() => {}}
      />,
    );
    open();
    const levels = screen.getAllByText('Ask User');
    const column = levels.map(name => (name.parentElement as HTMLElement).parentElement as HTMLElement);
    expect(
      column.some(box => box.className.includes('content-md:flex') && box.className.includes('items-center')),
    ).toBe(true);
    expect(column.every(box => !box.className.includes('content-md:block'))).toBe(true);
    const name = screen.getByText('Download files from web');
    const tile = ((name.parentElement as HTMLElement).parentElement as HTMLElement).parentElement
      ?.previousElementSibling as HTMLElement;
    expect(tile.className).toContain('text-ods-text-secondary');
  });

  it("lights an open category's rules frame with its header on hover", () => {
    render(
      <PolicyConfigurationPanel
        categories={categories}
        editMode={false}
        onPolicyPermissionChange={() => {}}
        onCategoryPermissionChange={() => {}}
      />,
    );
    open();
    const header = (screen.getByText('File Downloads').parentElement as HTMLElement).parentElement as HTMLElement;
    const frame = header.nextElementSibling as HTMLElement;
    expect(header.className).toContain('peer');
    expect(frame.className).toContain('peer-hover:bg-ods-bg-hover');
  });

  it('while editing, sets rules one by one on a phone: no bulk menu, the tool icon beside the name', () => {
    render(
      <PolicyConfigurationPanel
        categories={categories}
        editMode
        onPolicyPermissionChange={() => {}}
        onCategoryPermissionChange={() => {}}
      />,
    );
    open();
    // One bulk trigger (the content-md column), not a second one stacked for phones.
    expect(screen.getAllByText('Set Global Permission')).toHaveLength(1);
    const name = screen.getByText('Download files from web');
    const nameRow = (name.parentElement as HTMLElement).parentElement as HTMLElement;
    expect((nameRow.lastElementChild as HTMLElement).className).toContain('content-md:hidden');
    const tile = nameRow.parentElement?.previousElementSibling as HTMLElement;
    expect(tile.className).toContain('hidden content-md:flex');
  });

  it('counts a category with one rule in the singular', () => {
    render(
      <PolicyConfigurationPanel
        categories={categories}
        editMode={false}
        onPolicyPermissionChange={() => {}}
        onCategoryPermissionChange={() => {}}
      />,
    );
    expect(screen.getByText('1 Configuration')).toBeTruthy();
  });

  it('picks a level from the four while editing', () => {
    const onChange = vi.fn();
    render(
      <PolicyConfigurationPanel
        categories={categories}
        editMode
        onPolicyPermissionChange={onChange}
        onCategoryPermissionChange={() => {}}
      />,
    );
    open();
    const allow = screen.getAllByRole('button', { name: 'Allow' })[0] as HTMLElement;
    fireEvent.click(allow);
    expect(onChange).toHaveBeenCalledWith('downloads', 'web', 'ALLOW');
  });
});
