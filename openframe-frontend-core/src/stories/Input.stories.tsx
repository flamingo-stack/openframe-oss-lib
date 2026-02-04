import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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
    className: 'w-full',
  },
};

/**
 * Input with icon startAdornment.
 */
export const WithStartAdornmentIcon: Story = {
  args: {
    placeholder: 'Search...',
  },
};

/**
 * Input with both startAdornment and endAdornment.
 */
export const WithBothAdornments: Story = {
  args: {
    placeholder: '0.00',
  },
};

/**
 * Input with icon endAdornment.
 */
export const WithEndAdornmentIcon: Story = {
  args: {
    placeholder: 'Enter timeout...',
  },
};

/**
 * Disabled input with adornments.
 */
export const DisabledWithAdornments: Story = {
  args: {
    placeholder: '90',
    disabled: true,
  },
};

/**
 * Invalid input with adornments (error state).
 */
export const InvalidWithAdornments: Story = {
  args: {
    placeholder: '0',
    invalid: true,
  },
};

/**
 * Input with value and endAdornment.
 */
export const WithValueAndEndAdornment: Story = {
  args: {
    defaultValue: '90',
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
  },
};

/**
 * Preview mode - displays value as non-interactive element.
 */
export const Preview: Story = {
  args: {
    value: '90',
  },
};

/**
 * Preview mode with both adornments.
 */
export const PreviewWithBothAdornments: Story = {
  args: {
    value: '150.00',
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
      <Input placeholder="Disabled" disabled />
      <Input placeholder="Invalid" invalid />
      <Input value="90" />
    </div>
  ),
};