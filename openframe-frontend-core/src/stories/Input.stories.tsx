import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Input } from '../components/ui/input';
import { SearchIcon } from '../components/icons-v2-generated/interface/search-icon';

const meta = {
  title: 'UI/Input',
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default Input without adornments.
 */
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

/**
 * Input with text endAdornment.
 */
export const WithEndAdornmentText: Story = {
  args: {
    placeholder: '90',
    endAdornment: 'Seconds',
    className: 'w-full',
  },
};

/**
 * Input with icon startAdornment.
 */
export const WithStartAdornmentIcon: Story = {
  args: {
    placeholder: 'Search...',
    startAdornment: '🔍',
  },
};

/**
 * Input with both startAdornment and endAdornment.
 */
export const WithBothAdornments: Story = {
  args: {
    placeholder: '0.00',
    startAdornment: '$',
    endAdornment: 'USD',
  },
};

/**
 * Input with icon endAdornment.
 */
export const WithEndAdornmentIcon: Story = {
  args: {
    placeholder: 'Enter timeout...',
    endAdornment: '⏱',
  },
};

/**
 * Disabled input with adornments.
 */
export const DisabledWithAdornments: Story = {
  args: {
    placeholder: '90',
    endAdornment: 'Seconds',
    disabled: true,
  },
};

/**
 * Invalid input with adornments (error state).
 */
export const InvalidWithAdornments: Story = {
  args: {
    placeholder: '0',
    startAdornment: '$',
    invalid: true,
  },
};

/**
 * Input with value and endAdornment.
 */
export const WithValueAndEndAdornment: Story = {
  args: {
    defaultValue: '90',
    endAdornment: 'Seconds',
    className: 'max-w-[320px]',
  },
};

/**
 * Number input with unit adornment.
 */
export const NumberWithUnit: Story = {
  args: {
    type: 'number',
    placeholder: '100',
    endAdornment: 'ms',
  },
};

/**
 * Input with label.
 */
export const WithLabel: Story = {
  args: {
    placeholder: 'Enter text...',
    label: 'Username',
  },
};

/**
 * Input with label and error message.
 */
export const WithLabelAndError: Story = {
  args: {
    placeholder: 'Enter text...',
    label: 'Username',
    error: 'This field is required',
  },
};

/**
 * Input with label, value and no error (valid state).
 */
export const WithLabelAndValue: Story = {
  args: {
    label: 'Timeout',
    defaultValue: '90',
    endAdornment: 'Seconds',
  },
};

/**
 * Input with error only (no label).
 */
export const WithErrorOnly: Story = {
  args: {
    placeholder: 'Enter value...',
    error: 'Invalid value',
  },
};

/**
 * Search input with SearchIcon startAdornment.
 */
export const SearchInput: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search..."
        startAdornment={<SearchIcon size={20} />}
      />
    );
  },
};

/**
 * Input with loading spinner.
 */
export const Loading: Story = {
  args: {
    placeholder: 'Searching...',
    loading: true,
    startAdornment: <SearchIcon size={20} />,
  },
};

/**
 * All input variants displayed together for comparison.
 */
export const AllVariants: Story = {
  args: {
    placeholder: 'Default',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px' }}>
      <Input placeholder="Default input" />
      <Input placeholder="With adornments" startAdornment="$" endAdornment="USD" />
      <Input placeholder="Disabled" disabled />
      <Input placeholder="Invalid" invalid />
      <Input defaultValue="90" endAdornment="Seconds" />
      <Input label="With Label" placeholder="Enter text..." />
      <Input label="With Error" placeholder="Enter text..." error="This field is required" />
      <Input label="Valid Value" defaultValue="90" endAdornment="Seconds" />
    </div>
  ),
};
