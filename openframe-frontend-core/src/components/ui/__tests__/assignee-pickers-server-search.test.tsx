import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssigneeDropdown, type TicketAssigneeOption } from '../assignee-dropdown';
import { InfoSection } from '../info-section';
import { ReopenTicketModal } from '../reopen-ticket-modal';
import { TakeOverTicketModal, type TakeOverAssigneeOption, type TakeOverStatusOption } from '../take-over-ticket-modal';
import { TicketInfoSection } from '../ticket-info-section';

/**
 * The assignee pickers hand their search to the caller through
 * `onSearchChange` / `onAssigneeSearchChange` (the app looks users up on the
 * server). The prop has to reach the picker through every wrapper, the picker
 * must then list the caller's options as they are, and a picked or current
 * assignee must keep rendering when the server's answer no longer holds them.
 */

const PEOPLE: TicketAssigneeOption[] = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob', imageUrl: 'https://cdn.example.test/bob.png' },
  { value: 'carol', label: 'Carol' },
];

/** Each listed row's label — a row also draws the avatar's initials, so match the label's own node. */
const listedLabels = () =>
  screen.queryAllByRole('option').map(option => PEOPLE.find(person => within(option).queryByText(person.label))?.label);
const typeInto = (placeholder: string, query: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: query } });

describe('AssigneeDropdown (compact)', () => {
  it('without onSearchChange filters in memory, as before', () => {
    render(<AssigneeDropdown variant="compact" options={PEOPLE} onAssign={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Assign user' }));
    typeInto('Search users...', 'ca');
    expect(listedLabels()).toEqual(['Carol']);
  });

  it('with onSearchChange reports the query and lists the options unfiltered', () => {
    const onSearchChange = vi.fn();
    render(<AssigneeDropdown variant="compact" options={PEOPLE} onAssign={() => {}} onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Assign user' }));
    typeInto('Search users...', 'ca');
    expect(onSearchChange).toHaveBeenCalledWith('ca');
    expect(listedLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });
});

describe('AssigneeDropdown (default)', () => {
  it('without onSearchChange filters in memory, as before', () => {
    render(<AssigneeDropdown options={PEOPLE} onAssign={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Assign User' }));
    typeInto('Search users...', 'ca');
    expect(listedLabels()).toEqual(['Carol']);
  });

  it('with onSearchChange reports the query, lists the options unfiltered and names the current assignee', () => {
    const onSearchChange = vi.fn();
    render(
      <AssigneeDropdown
        options={PEOPLE}
        // Not in the server's answer (off the first page).
        currentAssignee={{ id: 'dave', name: 'Dave Doe' }}
        onAssign={() => {}}
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dave Doe' }));
    // The field names the assignee instead of reading their raw id.
    expect(screen.getByPlaceholderText<HTMLInputElement>('Search users...').value).toBe('Dave Doe');

    typeInto('Search users...', 'ca');
    expect(onSearchChange).toHaveBeenCalledWith('ca');
    expect(listedLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });
});

describe('info sections pass onSearchChange through', () => {
  it('InfoSection assignee row', () => {
    const onSearchChange = vi.fn();
    render(
      <InfoSection
        rows={[
          {
            id: 'assignee',
            label: 'Assigned',
            value: { type: 'assignee', options: PEOPLE, onAssign: () => {}, onSearchChange },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign user' }));
    typeInto('Search users...', 'bo');
    expect(onSearchChange).toHaveBeenCalledWith('bo');
    expect(listedLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('TicketInfoSection assigned config', () => {
    const onSearchChange = vi.fn();
    render(<TicketInfoSection assigned={{ options: PEOPLE, onAssign: () => {}, onSearchChange }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Assign User' }));
    typeInto('Search users...', 'bo');
    expect(onSearchChange).toHaveBeenCalledWith('bo');
    expect(listedLabels()).toEqual(['Alice', 'Bob', 'Carol']);
  });
});

const STATUSES: TakeOverStatusOption[] = [{ value: 'tech', label: 'Tech Required', color: '#ff0000' }];
const ASSIGNEES: TakeOverAssigneeOption[] = PEOPLE;

const assignedField = () => screen.getByPlaceholderText<HTMLInputElement>('Select Technician');

describe.each([
  ['TakeOverTicketModal', TakeOverTicketModal],
  ['ReopenTicketModal', ReopenTicketModal],
] as const)('%s Assigned picker', (_name, Modal) => {
  const baseProps = {
    isOpen: true,
    onClose: () => {},
    ticketRef: '1003: Printer on fire',
    statusOptions: STATUSES,
    onConfirm: () => {},
  };

  it('without onAssigneeSearchChange filters in memory, as before', () => {
    render(<Modal {...baseProps} assigneeOptions={ASSIGNEES} />);
    typeInto('Select Technician', 'ca');
    expect(listedLabels()).toEqual(['Carol']);
  });

  it('reports the query, lists the options unfiltered and keeps a picked assignee who leaves the answer', () => {
    const onAssigneeSearchChange = vi.fn();
    const props = { ...baseProps, onAssigneeSearchChange };
    const { rerender } = render(<Modal {...props} assigneeOptions={ASSIGNEES} />);

    typeInto('Select Technician', 'bo');
    expect(onAssigneeSearchChange).toHaveBeenCalledWith('bo');
    expect(listedLabels()).toEqual(['Alice', 'Bob', 'Carol']);

    fireEvent.click(screen.getByRole('option', { name: /Bob/ }));
    // The pick reset the query; the caller answers with a first page without Bob.
    expect(onAssigneeSearchChange).toHaveBeenLastCalledWith('');
    rerender(<Modal {...props} assigneeOptions={[ASSIGNEES[0]]} />);
    expect(assignedField().value).toBe('Bob');
    expect(screen.getByAltText('Bob')).toBeInTheDocument();
  });

  it('renders a pre-selected assignee the server never returned from initialAssigneeOption', () => {
    render(
      <Modal
        {...baseProps}
        assigneeOptions={ASSIGNEES}
        onAssigneeSearchChange={() => {}}
        initialAssigneeId="dave"
        initialAssigneeOption={{ value: 'dave', label: 'Dave', imageUrl: 'https://cdn.example.test/dave.png' }}
      />,
    );
    expect(assignedField().value).toBe('Dave');
    expect(screen.getByAltText('Dave')).toBeInTheDocument();
  });
});
