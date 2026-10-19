import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Autocomplete, type AutocompleteOption } from '../autocomplete';

/**
 * `onSearchChange` makes `Autocomplete` a server-searched picker (the engine
 * under the default `AssigneeDropdown` and the ticket modals' Assigned field):
 * report every query and every reset, filter nothing, hold the rows while the
 * next answer loads, and keep a selection's label after it leaves `options`.
 */

const PEOPLE: AutocompleteOption[] = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob' },
  { value: 'carol', label: 'Carol' },
];

const field = () => screen.getByRole<HTMLInputElement>('textbox');
const optionLabels = () => screen.queryAllByRole('option').map(option => option.textContent);
const typeQuery = (query: string) => fireEvent.change(field(), { target: { value: query } });

describe('Autocomplete without onSearchChange', () => {
  it('filters its options in memory, as before', () => {
    render(<Autocomplete options={PEOPLE} value={null} onChange={() => {}} />);
    typeQuery('bo');
    expect(optionLabels()).toEqual(['Bob']);
  });

  it('shows a selection missing from options by its raw value, as before', () => {
    render(<Autocomplete options={PEOPLE} value="dave" onChange={() => {}} />);
    expect(field().value).toBe('dave');
  });
});

describe('Autocomplete with onSearchChange', () => {
  it('reports the raw query on every keystroke and lists the options unfiltered', () => {
    const onSearchChange = vi.fn();
    render(<Autocomplete options={PEOPLE} value={null} onChange={() => {}} onSearchChange={onSearchChange} />);
    typeQuery('b');
    typeQuery('bo');
    expect(onSearchChange.mock.calls).toEqual([['b'], ['bo']]);
    expect(optionLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('reports an empty query when the field resets, without repeating it', () => {
    const onSearchChange = vi.fn();
    const onChange = vi.fn();
    render(<Autocomplete options={PEOPLE} value={null} onChange={onChange} onSearchChange={onSearchChange} />);

    // Opening and closing an unsearched field is not news.
    fireEvent.focus(field());
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(onSearchChange).not.toHaveBeenCalled();

    // Escape on a query resets it.
    typeQuery('al');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(onSearchChange.mock.calls).toEqual([['al'], ['']]);

    // So does a pick.
    typeQuery('ca');
    fireEvent.click(screen.getByRole('option', { name: 'Carol' }));
    expect(onChange).toHaveBeenCalledWith('carol');
    expect(onSearchChange.mock.calls).toEqual([['al'], [''], ['ca'], ['']]);
  });

  it('keeps the previous rows while the next answer loads, then shows the settled answer', () => {
    const props = { value: null, onChange: () => {}, onSearchChange: () => {}, noOptionsText: 'No users' };
    const { rerender } = render(<Autocomplete {...props} options={PEOPLE} />);
    typeQuery('zz');

    rerender(<Autocomplete {...props} options={[]} loading />);
    expect(optionLabels()).toEqual(['Alice', 'Bob', 'Carol']);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.queryByText('No users')).not.toBeInTheDocument();

    rerender(<Autocomplete {...props} options={[]} />);
    expect(optionLabels()).toEqual([]);
    expect(screen.getByText('No users')).toBeInTheDocument();
  });

  it('keeps the label of a selection the current answer no longer includes', () => {
    const props = { value: 'bob', onChange: () => {}, onSearchChange: () => {} };
    const { rerender } = render(<Autocomplete {...props} options={PEOPLE} />);
    expect(field().value).toBe('Bob');

    rerender(<Autocomplete {...props} options={[PEOPLE[0]]} />);
    expect(field().value).toBe('Bob');
  });

  it('renders a selection the server never returned from selectedOptions, without listing it', () => {
    render(
      <Autocomplete
        options={PEOPLE}
        value="dave"
        onChange={() => {}}
        onSearchChange={() => {}}
        selectedOptions={[{ value: 'dave', label: 'Dave' }]}
      />,
    );
    expect(field().value).toBe('Dave');
    fireEvent.focus(field());
    expect(optionLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });
});
