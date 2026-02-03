import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ClockIcon, DollarIcon, SearchIcon } from '../components/icons-v2-generated';
import { Input } from '../components/ui/input';

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
 * Input with text endAdornment (like "Seconds" from Figma design).
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
    startAdornment: <SearchIcon className="w-5 h-5" />,
  },
};

/**
 * Input with both startAdornment and endAdornment.
 */
export const WithBothAdornments: Story = {
  args: {
    placeholder: '0.00',
    startAdornment: <DollarIcon className="w-5 h-5" />,
    endAdornment: 'USD',
  },
};

/**
 * Input with icon endAdornment.
 */
export const WithEndAdornmentIcon: Story = {
  args: {
    placeholder: 'Enter timeout...',
    endAdornment: <ClockIcon className="w-5 h-5" />,
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
    endAdornment: 'Seconds',
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
    endAdornment: 'MB',
  },
};

/**
 * Preview mode - displays value as non-interactive element.
 */
export const Preview: Story = {
  args: {
    value: '90',
    endAdornment: 'Seconds',
    preview: true,
  },
};

/**
 * Preview mode with both adornments.
 */
export const PreviewWithBothAdornments: Story = {
  args: {
    value: '150.00',
    startAdornment: <DollarIcon className="w-5 h-5" />,
    endAdornment: 'USD',
    preview: true,
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
      <Input placeholder="90" endAdornment="Seconds" />
      <Input placeholder="Search..." startAdornment={<SearchIcon className="w-5 h-5" />} />
      <Input placeholder="0.00" startAdornment={<DollarIcon className="w-5 h-5" />} endAdornment="USD" />
      <Input placeholder="Disabled" endAdornment="Unit" disabled />
      <Input placeholder="Invalid" endAdornment="Unit" invalid />
      <Input value="90" endAdornment="Seconds" preview />
    </div>
  ),
};
