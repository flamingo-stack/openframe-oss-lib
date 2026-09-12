import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { personFirstName } from '../../../utils/format';
import { AvatarStack } from '../avatar-stack';
import { PeopleCell, PersonCell } from '../people-cell';

/**
 * The people-column contract, pinned at the primitive:
 *
 *   · one person reads as ONE layout wherever it appears (name + second line),
 *     so a single implementation owner and a DRI look identical;
 *   · several people become first names beside a FIXED-width stack, so every
 *     multi-person row's names start at the same x;
 *   · the "+N" count, and the group's accessible name, say what they mean.
 */

const person = (name: string, key: string | number = name) => ({
  key,
  name,
  avatarUrl: null,
  secondary: `${name} title`,
});

describe('personFirstName', () => {
  it('takes the first word, ignoring surrounding whitespace', () => {
    expect(personFirstName('  Ada   Lovelace ')).toBe('Ada');
  });
  it('falls back on an empty or missing name', () => {
    expect(personFirstName('   ')).toBeNull();
    expect(personFirstName(null, 'friend')).toBe('friend');
  });
});

describe('PersonCell', () => {
  it('renders the name and the second line', () => {
    render(<PersonCell name="Ada Lovelace" secondary="Engineer" />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Engineer')).toBeTruthy();
  });
  it('marks an expected-but-missing second line, and names the empty state', () => {
    render(<PersonCell secondary={null} />);
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByText('·')).toBeTruthy();
  });
  it('becomes a button when clickable', () => {
    render(<PersonCell name="Ada" onClick={() => {}} actionTitle="Filter by Ada" />);
    expect(screen.getByRole('button', { name: /Ada/ }).getAttribute('title')).toBe('Filter by Ada');
  });
});

describe('PeopleCell', () => {
  it('renders one person exactly as PersonCell does', () => {
    const { container: single } = render(<PeopleCell people={[person('Ada Lovelace')]} />);
    const { container: direct } = render(<PersonCell name="Ada Lovelace" secondary="Ada Lovelace title" />);
    expect(single.innerHTML).toBe(direct.innerHTML);
  });

  it('joins first names with & and keeps the full names for assistive tech', () => {
    render(<PeopleCell people={[person('Dmytro K'), person('Michael A'), person('Ilona K')]} />);
    expect(screen.getByText('Dmytro & Michael & Ilona')).toBeTruthy();
    expect(screen.getByText('Dmytro K, Michael A, Ilona K')).toBeTruthy();
    expect(screen.queryByText('Dmytro K title')).toBeNull();
  });

  it('reserves the same stack width for two people and for five', () => {
    const width = (count: number) => {
      const { unmount } = render(<PeopleCell people={Array.from({ length: count }, (_, i) => person(`P${i} X`, i))} />);
      // `hidden`: the stack is decorative (aria-hidden) beside the names.
      const value = screen.getByRole('group', { hidden: true }).style.width;
      unmount();
      return value;
    };
    expect(width(2)).toBe('52px');
    expect(width(5)).toBe('52px');
  });
});

describe('AvatarStack', () => {
  it('in slots mode shows slots-1 faces and a count for the rest', () => {
    render(<AvatarStack size="sm" slots={2} people={[person('A'), person('B'), person('C')]} />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getAllByTitle(/^[ABC]$/)).toHaveLength(1);
  });
  it('fills every slot with a face when the people fit', () => {
    render(<AvatarStack size="sm" slots={2} people={[person('A'), person('B')]} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
  it('names the group after what the people are', () => {
    render(<AvatarStack label="Hosts" people={[person('Ada'), person('Lin')]} />);
    expect(screen.getByRole('group', { name: 'Hosts: Ada, Lin' })).toBeTruthy();
  });
  it('defaults the group name to Assignees', () => {
    render(<AvatarStack people={[person('Ada')]} />);
    expect(screen.getByRole('group', { name: 'Assignees: Ada' })).toBeTruthy();
  });
});
