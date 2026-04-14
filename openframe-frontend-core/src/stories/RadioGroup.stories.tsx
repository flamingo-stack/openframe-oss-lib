import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';

const meta = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A radio group component built on Radix UI primitives, styled to match the OpenFrame design system. Use for selecting a single option from a set of mutually exclusive choices.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text', description: 'Controlled selected value' },
    defaultValue: { control: 'text', description: 'Default selected value (uncontrolled)' },
    disabled: { control: 'boolean', description: 'Disable the entire radio group' },
    orientation: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
      description: 'Orientation of the radio group',
    },
    onValueChange: { action: 'valueChange' },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderItem = (value: string, id: string, label: string, disabled = false) => (
  <div className="flex items-center gap-3" key={value}>
    <RadioGroupItem value={value} id={id} disabled={disabled} />
    <label
      htmlFor={id}
      className="text-base text-ods-text-primary cursor-pointer select-none"
    >
      {label}
    </label>
  </div>
);

export const Default: Story = {
  args: {},
  render: (args) => (
    <RadioGroup {...args}>
      {renderItem('option-1', 'default-1', 'Option 1')}
      {renderItem('option-2', 'default-2', 'Option 2')}
      {renderItem('option-3', 'default-3', 'Option 3')}
    </RadioGroup>
  ),
};

export const WithDefaultValue: Story = {
  args: { defaultValue: 'option-2' },
  render: (args) => (
    <RadioGroup {...args}>
      {renderItem('option-1', 'dv-1', 'Option 1')}
      {renderItem('option-2', 'dv-2', 'Option 2')}
      {renderItem('option-3', 'dv-3', 'Option 3')}
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'option-1' },
  render: (args) => (
    <RadioGroup {...args}>
      {renderItem('option-1', 'd-1', 'Option 1')}
      {renderItem('option-2', 'd-2', 'Option 2')}
    </RadioGroup>
  ),
};

export const DisabledItem: Story = {
  args: { defaultValue: 'option-1' },
  render: (args) => (
    <RadioGroup {...args}>
      {renderItem('option-1', 'di-1', 'Option 1')}
      {renderItem('option-2', 'di-2', 'Option 2 (disabled)', true)}
      {renderItem('option-3', 'di-3', 'Option 3')}
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal', defaultValue: 'small' },
  render: (args) => (
    <RadioGroup {...args} className="flex flex-row gap-6">
      {renderItem('small', 'h-s', 'Small')}
      {renderItem('medium', 'h-m', 'Medium')}
      {renderItem('large', 'h-l', 'Large')}
    </RadioGroup>
  ),
};

export const Controlled: Story = {
  args: {},
  render: function ControlledRadioGroup() {
    const [value, setValue] = useState('option-1');
    return (
      <div className="flex flex-col gap-3">
        <RadioGroup value={value} onValueChange={setValue}>
          {renderItem('option-1', 'c-1', 'Option 1')}
          {renderItem('option-2', 'c-2', 'Option 2')}
          {renderItem('option-3', 'c-3', 'Option 3')}
        </RadioGroup>
        <span className="text-xs text-ods-text-secondary">Selected: {value}</span>
      </div>
    );
  },
};

export const FlamingoTheme: Story = {
  args: { defaultValue: 'option-2' },
  decorators: [
    (Story) => (
      <div data-app-type="flamingo">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <RadioGroup {...args}>
      {renderItem('option-1', 'f-1', 'Option 1')}
      {renderItem('option-2', 'f-2', 'Option 2')}
      {renderItem('option-3', 'f-3', 'Option 3')}
    </RadioGroup>
  ),
};
