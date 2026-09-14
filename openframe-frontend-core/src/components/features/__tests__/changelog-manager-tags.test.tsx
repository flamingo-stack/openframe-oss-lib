/**
 * `ChangelogManager` tags: with `tagOptions` each entry's header shows its tag's
 * label as a badge, a new entry starts on the first option, and the field labels
 * follow the caller's wording. Without `tagOptions` nothing changes.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChangelogManager } from '../changelog-manager';

const tagOptions = [
  { value: 'us', label: 'Us' },
  { value: 'prospect', label: 'Prospect' },
];

describe('ChangelogManager tags', () => {
  it('shows the tag label in the entry header', () => {
    render(
      <ChangelogManager
        title="Next steps"
        entries={[{ title: 'Send pricing', description: '', tag: 'prospect' }]}
        onChange={() => {}}
        tagOptions={tagOptions}
      />,
    );
    expect(screen.getByText('Send pricing')).toBeTruthy();
    expect(screen.getByText('Prospect')).toBeTruthy();
  });

  it('starts a new entry on the first tag option', () => {
    const onChange = vi.fn();
    render(<ChangelogManager title="Next steps" entries={[]} onChange={onChange} tagOptions={tagOptions} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Entry/ }));
    expect(onChange).toHaveBeenCalledWith([{ title: '', description: '', tag: 'us' }]);
  });

  it('uses the caller field labels and adds no tag without options', () => {
    const onChange = vi.fn();
    render(
      <ChangelogManager
        title="Objections"
        entries={[{ title: 'Too expensive', description: 'Offered annual pricing' }]}
        onChange={onChange}
        titleLabel="Objection"
        descriptionLabel="Our response"
        expandAll
      />,
    );
    expect(screen.getByText('Objection *')).toBeTruthy();
    expect(screen.getByText('Our response')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add Entry/ }));
    expect(onChange).toHaveBeenCalledWith([
      { title: 'Too expensive', description: 'Offered annual pricing' },
      { title: '', description: '' },
    ]);
  });
});
