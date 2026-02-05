import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Checkbox } from '../components/ui/checkbox';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A basic checkbox component built on Radix UI primitives. Use for simple boolean selections.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Controlled checked state',
    },
    defaultChecked: {
      control: 'boolean',
      description: 'Default checked state for uncontrolled usage',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the checkbox is disabled',
    },
    onCheckedChange: {
      action: 'checkedChange',
      description: 'Callback when checked state changes',
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default unchecked checkbox.
 */
export const Default: Story = {
  args: {},
};

/**
 * Checkbox in checked state.
 */
export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

/**
 * Disabled checkbox.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

/**
 * Disabled and checked checkbox.
 */
export const DisabledChecked: Story = {
  args: {
    disabled: true,
    defaultChecked: true,
  },
};

/**
 * Checkbox with an associated label using htmlFor.
 */
export const WithLabel: Story = {
  args: {},
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" {...args} />
      <label
        htmlFor="terms"
        className="text-sm text-ods-text-primary cursor-pointer select-none"
      >
        Accept terms and conditions
      </label>
    </div>
  ),
};

/**
 * Controlled checkbox with state management.
 */
export const Controlled: Story = {
  args: {},
  render: function ControlledCheckbox() {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="controlled"
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          <label
            htmlFor="controlled"
            className="text-sm text-ods-text-primary cursor-pointer select-none"
          >
            Controlled checkbox
          </label>
        </div>
        <span className="text-xs text-[#888]">
          Checked: {checked ? 'true' : 'false'}
        </span>
      </div>
    );
  },
};

/**
 * Multiple checkboxes in a group.
 */
export const CheckboxGroup: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="option1" defaultChecked />
        <label htmlFor="option1" className="text-sm text-ods-text-primary cursor-pointer select-none">
          Option 1
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="option2" />
        <label htmlFor="option2" className="text-sm text-ods-text-primary cursor-pointer select-none">
          Option 2
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="option3" disabled />
        <label htmlFor="option3" className="text-sm text-ods-text-secondary cursor-not-allowed select-none">
          Option 3 (disabled)
        </label>
      </div>
    </div>
  ),
};

/**
 * All checkbox states displayed together.
 */
export const AllVariants: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="unchecked" />
          <label htmlFor="unchecked" className="text-sm text-ods-text-primary">Unchecked</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="checked" defaultChecked />
          <label htmlFor="checked" className="text-sm text-ods-text-primary">Checked</label>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="disabled-unchecked" disabled />
          <label htmlFor="disabled-unchecked" className="text-sm text-ods-text-secondary">Disabled</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="disabled-checked" disabled defaultChecked />
          <label htmlFor="disabled-checked" className="text-sm text-ods-text-secondary">Disabled Checked</label>
        </div>
      </div>
    </div>
  ),
};
