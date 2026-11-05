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
  it("shows a rule's level in its colour, and its pattern on one line", () => {
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
    expect(level?.className).toContain('text-ods-warning');
    const pattern = screen.getByTitle('(?i)^(Invoke-WebRequest|wget|curl).*');
    expect(pattern.className).toContain('truncate');
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull();
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
