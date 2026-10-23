import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from '../components/ui/search-input';

// An enter-to-search host: a submitted search must not stay applied once its text is gone.
function Host({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [value, setValue] = useState('sso');
  return (
    <SearchInput value={value} onChange={setValue} onSubmit={onSubmit} showDropdown={false} placeholder="Search" />
  );
}

describe('SearchInput submits the empty search when the box is emptied', () => {
  it('by the clear button', () => {
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onSubmit).toHaveBeenCalledWith('');
  });

  it('by deleting the text, once (not on every keystroke, and not when it was already empty)', () => {
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'ss' } });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '' } });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('');
  });
});
