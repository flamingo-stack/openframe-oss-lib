import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { MonitorIcon, UserPlusIcon } from '../components/icons-v2-generated';
import { SearchableSelect, type SearchableSelectProps } from '../components/ui/searchable-select';
import { SquareAvatar } from '../components/ui/square-avatar';

const meta = {
  title: 'UI/SearchableSelect',
  component: SearchableSelect,
  argTypes: {
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Select-style dropdown whose first item is a search field filtering the option list - ' +
          'the ticket assignee "Search users..." pattern generalized for any entity. The default ' +
          'trigger matches SelectTrigger; pass a custom trigger for icon-button use cases ' +
          '(AssigneeDropdown compact is built on this component).',
      },
    },
  },
} satisfies Meta<typeof SearchableSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const DEVICES = [
  { value: '1', label: "John's MacBook Pro" },
  { value: '2', label: 'Design-Studio-iMac' },
  { value: '3', label: 'Front-Desk-PC' },
  { value: '4', label: 'QA-Windows-11' },
  { value: '5', label: 'Server-Room-Linux' },
  { value: '6', label: "Olivia's ThinkPad" },
  { value: '7', label: 'Warehouse-Scanner-01' },
  { value: '8', label: 'Reception-Tablet' },
];

function ControlledSelect(props: Partial<SearchableSelectProps>) {
  const [value, setValue] = useState<string | null>(props.value ?? null);
  return (
    <SearchableSelect
      options={DEVICES}
      placeholder="Select Device"
      searchPlaceholder="Search for Device"
      emptyText="No devices found"
      {...props}
      value={value}
      onValueChange={setValue}
    />
  );
}

/** Default select-like trigger; the search input is the first dropdown item. */
export const DeviceSelect: Story = {
  args: {
    options: DEVICES,
    onValueChange: () => {},
    placeholder: 'Select Device',
    searchPlaceholder: 'Search for Device',
    emptyText: 'No devices found',
  },
  render: args => (
    <div className="w-[320px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <ControlledSelect {...args} />
    </div>
  ),
};

/** Options can carry a leading icon/avatar node. */
export const WithOptionIcons: Story = {
  args: {
    options: DEVICES.map(d => ({
      ...d,
      icon: <MonitorIcon className="size-5 shrink-0 text-ods-text-secondary" />,
    })),
    onValueChange: () => {},
    placeholder: 'Select Device',
    searchPlaceholder: 'Search for Device',
    emptyText: 'No devices found',
  },
  render: args => (
    <div className="w-[320px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <ControlledSelect {...args} />
    </div>
  ),
};

/** Custom icon-button trigger - the AssigneeDropdown compact use case. */
export const CustomTrigger: Story = {
  args: {
    options: ['Roman Smith', 'Mike Johnson', 'Olivia Chen', 'Ava Martinez'].map((name, i) => ({
      value: String(i + 1),
      label: name,
      icon: <SquareAvatar alt={name} fallback={name} size="sm" variant="round" className="h-6 w-6 shrink-0" />,
    })),
    onValueChange: () => {},
    searchPlaceholder: 'Search users...',
    emptyText: 'No users found',
    align: 'end',
    contentClassName: 'w-72',
    trigger: (
      <button
        type="button"
        aria-label="Assign user"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ods-border text-ods-text-secondary transition-colors hover:border-ods-accent hover:text-ods-accent"
      >
        <UserPlusIcon className="size-4" />
      </button>
    ),
  },
  render: args => (
    <div className="flex w-[320px] justify-end bg-ods-bg p-[var(--spacing-system-mf)]">
      <ControlledSelect {...args} />
    </div>
  ),
};

/** Loading state shown inside the dropdown. */
export const Loading: Story = {
  args: {
    options: [],
    onValueChange: () => {},
    placeholder: 'Select Device',
    searchPlaceholder: 'Search for Device',
    isLoading: true,
  },
  render: args => (
    <div className="w-[320px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <ControlledSelect {...args} />
    </div>
  ),
};
