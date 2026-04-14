import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Tag } from '../components/ui/tag';
import { TagPercentIcon } from '../components/icons-v2-generated/shopping/tag-percent-icon';
import { RadioGroupBlock } from '../components/ui/radio-group';

const DiscountTag = ({ value }: { value: string }) => (
  <Tag
    variant="success"
    icon={<TagPercentIcon className="size-4" />}
    label={value}
  />
);

const meta = {
  title: 'UI/RadioGroupBlock',
  component: RadioGroupBlock,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A radio group rendered as bordered blocks with label and optional description. Matches the ODS design system with dark theme styling.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    defaultValue: { control: 'text' },
    value: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'text' },
    variant: { control: 'radio', options: ['separated', 'grouped'] },
    onValueChange: { action: 'valueChange' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RadioGroupBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseOptions = [
  { value: 'option-1', label: 'Radio Button Text' },
  { value: 'option-2', label: 'Radio Button Text' },
  { value: 'option-3', label: 'Radio Button Text' },
];

export const Default: Story = {
  args: {
    name: 'default',
    options: baseOptions,
  },
};

export const WithDefaultValue: Story = {
  args: {
    name: 'with-default',
    defaultValue: 'option-2',
    options: baseOptions,
  },
};

export const WithDescriptions: Story = {
  args: {
    name: 'descriptions',
    defaultValue: 'starter',
    options: [
      { value: 'starter', label: 'Starter', description: 'Perfect for individuals getting started.' },
      { value: 'pro', label: 'Pro', description: 'Advanced features for growing teams.' },
      { value: 'enterprise', label: 'Enterprise', description: 'Custom solutions for large organizations.' },
    ],
  },
};

export const Disabled: Story = {
  args: {
    name: 'disabled',
    disabled: true,
    defaultValue: 'option-1',
    options: baseOptions,
  },
};

export const DisabledItem: Story = {
  args: {
    name: 'disabled-item',
    defaultValue: 'option-1',
    options: [
      { value: 'option-1', label: 'Radio Button Text' },
      { value: 'option-2', label: 'Radio Button Text', disabled: true },
      { value: 'option-3', label: 'Radio Button Text' },
    ],
  },
};

export const Error: Story = {
  args: {
    name: 'error',
    options: baseOptions,
    error: 'Please select an option to continue.',
  },
};

export const Controlled: Story = {
  args: {
    name: 'controlled',
    options: baseOptions,
  },
  render: function ControlledBlock(args) {
    const [value, setValue] = useState('option-1');
    return (
      <div className="flex flex-col gap-3">
        <RadioGroupBlock {...args} value={value} onValueChange={setValue} />
        <span className="text-xs text-ods-text-secondary">Selected: {value}</span>
      </div>
    );
  },
};

export const AllStates: Story = {
  args: {
    name: 'all-states',
    options: baseOptions,
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <RadioGroupBlock
        name="state-default"
        defaultValue="option-1"
        options={[
          { value: 'option-1', label: 'Selected' },
          { value: 'option-2', label: 'Unselected' },
        ]}
      />
      <RadioGroupBlock
        name="state-disabled"
        disabled
        defaultValue="option-1"
        options={[
          { value: 'option-1', label: 'Disabled selected' },
          { value: 'option-2', label: 'Disabled unselected' },
        ]}
      />
      <RadioGroupBlock
        name="state-error"
        options={baseOptions}
        error="Please select an option."
      />
      <RadioGroupBlock
        name="state-descriptions"
        defaultValue="option-1"
        options={[
          { value: 'option-1', label: 'Run as User', description: 'Windows Only' },
          { value: 'option-2', label: 'Run as System', description: 'All platforms' },
        ]}
      />
    </div>
  ),
};

/**
 * Grouped variant with trailing discount tags — device-pricing picker from Figma.
 */
export const DevicePricing: Story = {
  args: {
    name: 'device-pricing',
    variant: 'grouped',
    defaultValue: '300',
    options: [
      {
        value: '100',
        label: '100 devices',
        description: '$5,400/year',
        trailing: <DiscountTag value="-10%" />,
      },
      {
        value: '300',
        label: '300 devices',
        description: '$14,400/year',
        trailing: <DiscountTag value="-20%" />,
      },
      {
        value: '500',
        label: '500 devices',
        description: '$22,500/year',
        trailing: <DiscountTag value="-25%" />,
      },
      {
        value: 'custom',
        label: 'Custom Amount',
        description: 'Choose your number of devices',
      },
    ],
  },
};

/**
 * Grouped variant fully disabled — matches the disabled state of the device-pricing picker.
 */
export const DevicePricingDisabled: Story = {
  args: {
    name: 'device-pricing-disabled',
    variant: 'grouped',
    disabled: true,
    defaultValue: '300',
    options: [
      {
        value: '100',
        label: '100 devices',
        description: '$475/month',
        trailing: <DiscountTag value="-5%" />,
      },
      {
        value: '300',
        label: '300 devices',
        description: '$1,350/month',
        trailing: <DiscountTag value="-10%" />,
      },
      {
        value: '500',
        label: '500 devices',
        description: '$2,125/month',
        trailing: <DiscountTag value="-15%" />,
      },
      {
        value: 'custom',
        label: 'Custom Amount',
        description: 'Choose your number of devices',
      },
    ],
  },
};

/**
 * Grouped variant — options share a single container with dividers, no trailing slot.
 */
export const Grouped: Story = {
  args: {
    name: 'grouped',
    variant: 'grouped',
    defaultValue: 'option-2',
    options: [
      { value: 'option-1', label: 'Monthly', description: '$49/month' },
      { value: 'option-2', label: 'Annual', description: '$490/year' },
      { value: 'option-3', label: 'Lifetime', description: 'One-time $1,490' },
    ],
  },
};

export const FlamingoTheme: Story = {
  args: {
    name: 'flamingo',
    defaultValue: 'option-2',
    options: baseOptions,
  },
  decorators: [
    (Story) => (
      <div data-app-type="flamingo" style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
};
