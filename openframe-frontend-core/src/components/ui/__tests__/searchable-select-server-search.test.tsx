import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchableSelect, type SearchableSelectOption } from '../searchable-select';

/**
 * `onSearchChange` turns `SearchableSelect` into a server-searched picker: the
 * caller's `options` are the server's answer, so the field must report every
 * query, filter nothing itself, hold its rows between keystrokes, and keep the
 * trigger's label for a selection the answer no longer includes. Without the
 * prop it must stay the in-memory filter it has always been.
 */

const PEOPLE: SearchableSelectOption[] = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob' },
  { value: 'carol', label: 'Carol' },
];

const optionLabels = () => screen.queryAllByRole('option').map(option => option.textContent);
const openPicker = (triggerText: string) => fireEvent.click(screen.getByRole('button', { name: triggerText }));
const typeQuery = (query: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: query } });

describe('SearchableSelect without onSearchChange', () => {
  it('filters its options in memory, as before', () => {
    render(<SearchableSelect options={PEOPLE} onValueChange={() => {}} />);
    openPicker('Select...');
    typeQuery('bo');
    expect(optionLabels()).toEqual(['Bob']);
  });

  it('shows the loading rows in place of the options while loading', () => {
    render(<SearchableSelect options={PEOPLE} isLoading onValueChange={() => {}} />);
    openPicker('Select...');
    expect(screen.getByRole('status')).toHaveTextContent('Loading options');
    expect(optionLabels()).toEqual([]);
  });
});

describe('SearchableSelect with onSearchChange', () => {
  it('reports the raw query on every change and lists the options unfiltered', () => {
    const onSearchChange = vi.fn();
    render(<SearchableSelect options={PEOPLE} onValueChange={() => {}} onSearchChange={onSearchChange} />);
    openPicker('Select...');
    typeQuery('b');
    typeQuery('bo ');
    expect(onSearchChange.mock.calls).toEqual([['b'], ['bo ']]);
    // The caller's options are the server's answer: nothing is filtered out.
    expect(optionLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('keeps the previous rows while the next answer loads, then shows the settled answer', () => {
    const props = { onValueChange: () => {}, onSearchChange: () => {} };
    const { rerender } = render(<SearchableSelect {...props} options={PEOPLE} />);
    openPicker('Select...');
    typeQuery('zz');

    // The caller emptied `options` for the in-flight request: no blank list,
    // no "no results" flash.
    rerender(<SearchableSelect {...props} options={[]} isLoading />);
    expect(optionLabels()).toEqual(['Alice', 'Bob', 'Carol']);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('No results found')).not.toBeInTheDocument();

    // The answer settled empty: that IS the empty state.
    rerender(<SearchableSelect {...props} options={[]} />);
    expect(optionLabels()).toEqual([]);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('shows the loading rows only while there is nothing to list yet', () => {
    render(<SearchableSelect options={[]} isLoading onValueChange={() => {}} onSearchChange={() => {}} />);
    openPicker('Select...');
    expect(screen.getByRole('status')).toHaveTextContent('Loading options');
  });

  it('reports an empty query when the dropdown closes on a query, and only then', () => {
    const onSearchChange = vi.fn();
    const onValueChange = vi.fn();
    render(<SearchableSelect options={PEOPLE} onValueChange={onValueChange} onSearchChange={onSearchChange} />);

    // Open and close without searching: nothing to reset.
    openPicker('Select...');
    fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Escape' });
    expect(onSearchChange).not.toHaveBeenCalled();

    // A pick closes the dropdown and clears the query.
    openPicker('Select...');
    typeQuery('bo');
    fireEvent.click(screen.getByRole('option', { name: 'Bob' }));
    expect(onValueChange).toHaveBeenCalledWith('bob');
    expect(onSearchChange.mock.calls).toEqual([['bo'], ['']]);
  });

  it('keeps the trigger label of a selection the current answer no longer includes', () => {
    const props = { value: 'bob', onValueChange: () => {}, onSearchChange: () => {} };
    const { rerender } = render(<SearchableSelect {...props} options={PEOPLE} />);
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();

    rerender(<SearchableSelect {...props} options={[PEOPLE[0]]} />);
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
  });
});
