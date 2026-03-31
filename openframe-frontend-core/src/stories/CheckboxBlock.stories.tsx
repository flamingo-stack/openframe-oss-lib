import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { CheckboxBlock } from '../components/ui/checkbox-block';

const meta = {
  title: 'UI/CheckboxBlock',
  component: CheckboxBlock,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A checkbox with label inside a bordered block container. Matches the ODS design system with dark theme styling.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'The label text displayed next to the checkbox',
    },
    checked: {
      control: 'boolean',
      description: 'Controlled checked state',
    },
    defaultChecked: {
      control: 'boolean',
      description: 'Default checked state for uncontrolled usage',
    },
    description: {
      control: 'text',
      description: 'Optional secondary description text below the label',
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
  decorators: [
    (Story) => (
      <div style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CheckboxBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default unchecked checkbox block.
 */
export const Default: Story = {
  args: {
    label: 'Checkbox Text',
  },
};

/**
 * Checkbox block matching the Figma design with "Repeat Script Run" label.
 */
export const RepeatScriptRun: Story = {
  args: {
    label: 'Repeat Script Run',
  },
};

/**
 * Checkbox block in checked state.
 */
export const Checked: Story = {
  args: {
    label: 'Checkbox Text',
    defaultChecked: true,
  },
};

/**
 * Disabled checkbox block.
 */
export const Disabled: Story = {
  args: {
    label: 'Disabled Checkbox',
    disabled: true,
  },
};

/**
 * Disabled and checked checkbox block.
 */
export const DisabledChecked: Story = {
  args: {
    label: 'Disabled Checked',
    disabled: true,
    defaultChecked: true,
  },
};

/**
 * Controlled checkbox block with state management.
 */
export const Controlled: Story = {
  args: {
    label: 'Controlled Checkbox',
  },
  render: function ControlledCheckbox() {
    const [checked, setChecked] = useState(false);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <CheckboxBlock
          label="Controlled Checkbox"
          checked={checked}
          onCheckedChange={setChecked}
        />
        <span style={{ color: '#888', fontSize: '14px' }}>
          Checked: {checked ? 'true' : 'false'}
        </span>
      </div>
    );
  },
};

/**
 * Long label text demonstrating text wrapping behavior.
 */
export const LongLabel: Story = {
  args: {
    label: 'This is a longer checkbox label that demonstrates how the component handles extended text content',
  },
};

/**
 * Checkbox block with description text (taller h-16 variant).
 */
export const WithDescription: Story = {
  args: {
    label: 'Run as User',
    description: 'Windows Only',
  },
};

/**
 * Checkbox block with description, checked.
 */
export const WithDescriptionChecked: Story = {
  args: {
    label: 'Run as User',
    description: 'Windows Only',
    defaultChecked: true,
  },
};

/**
 * Checkbox block with description, disabled.
 */
export const WithDescriptionDisabled: Story = {
  args: {
    label: 'Run as User',
    description: 'Windows Only',
    disabled: true,
  },
};

/**
 * Error state — red border to indicate validation failure.
 */
export const Error: Story = {
  args: {
    label: 'Send me an SMS if my email gets caught by spam filters',
    description: 'I agree to receive recurring automated text messages at the phone number provided. Msg & data rates may apply.',
    error: 'Please agree to SMS notifications to continue.',
  },
};

/**
 * Flamingo theme (pink accent) with error state.
 */
export const FlamingoError: Story = {
  args: {
    label: 'Send me an SMS if my email gets caught by spam filters',
    description: 'I agree to receive recurring automated text messages at the phone number provided. Msg & data rates may apply.',
    error: 'Please agree to SMS notifications to continue.',
  },
  decorators: [
    (Story) => (
      <div data-app-type="flamingo" style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Flamingo theme (pink accent) checked.
 */
export const FlamingoChecked: Story = {
  args: {
    label: 'Send me an SMS if my email gets caught by spam filters',
    description: 'I agree to receive recurring automated text messages at the phone number provided. Msg & data rates may apply.',
    defaultChecked: true,
  },
  decorators: [
    (Story) => (
      <div data-app-type="flamingo" style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * All variants displayed together for comparison.
 */
export const AllVariants: Story = {
  args: {
    label: 'Default',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px' }}>
      <CheckboxBlock label="Default unchecked" />
      <CheckboxBlock label="Default checked" defaultChecked />
      <CheckboxBlock label="Repeat Script Run" />
      <CheckboxBlock label="Disabled unchecked" disabled />
      <CheckboxBlock label="Disabled checked" disabled defaultChecked />
      <CheckboxBlock label="Error state" error="This field is required." />
      <CheckboxBlock label="Run as User" description="Windows Only" />
      <CheckboxBlock label="Run as User" description="Windows Only" defaultChecked />
      <CheckboxBlock label="Run as User" description="Windows Only" disabled />
    </div>
  ),
};
