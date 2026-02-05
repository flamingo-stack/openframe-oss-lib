import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { CheckboxWithDescription } from '../components/ui/checkbox-with-description';

const meta = {
  title: 'UI/CheckboxWithDescription',
  component: CheckboxWithDescription,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A checkbox component with title and description inside a bordered card. Useful for settings and configuration options that need additional context.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    id: {
      control: 'text',
      description: 'Unique ID for the checkbox',
    },
    title: {
      control: 'text',
      description: 'The main label/title for the checkbox',
    },
    description: {
      control: 'text',
      description: 'Additional description text below the title',
    },
    checked: {
      control: 'boolean',
      description: 'Controlled checked state',
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
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CheckboxWithDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default unchecked checkbox with description.
 */
export const Default: Story = {
  args: {
    id: 'default',
    title: 'Enable notifications',
    description: 'Receive email notifications when important events occur.',
    checked: false,
    onCheckedChange: () => {},
  },
};

/**
 * Checkbox with description in checked state.
 */
export const Checked: Story = {
  args: {
    id: 'checked',
    title: 'Enable notifications',
    description: 'Receive email notifications when important events occur.',
    checked: true,
    onCheckedChange: () => {},
  },
};

/**
 * Disabled checkbox with description.
 */
export const Disabled: Story = {
  args: {
    id: 'disabled',
    title: 'Premium feature',
    description: 'This feature is only available on premium plans.',
    checked: false,
    disabled: true,
    onCheckedChange: () => {},
  },
};

/**
 * Disabled and checked checkbox with description.
 */
export const DisabledChecked: Story = {
  args: {
    id: 'disabled-checked',
    title: 'Required setting',
    description: 'This setting is required and cannot be changed.',
    checked: true,
    disabled: true,
    onCheckedChange: () => {},
  },
};

/**
 * Checkbox with a longer description text.
 */
export const LongDescription: Story = {
  args: {
    id: 'long-desc',
    title: 'Data retention',
    description: 'Keep historical data for analytics and reporting purposes. This includes device logs, script execution history, and system metrics collected over time.',
    checked: false,
    onCheckedChange: () => {},
  },
};

/**
 * Controlled checkbox with state management.
 */
export const Controlled: Story = {
  args: {
    id: 'controlled',
    title: 'Controlled checkbox',
    description: 'This checkbox is controlled by React state.',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function ControlledCheckbox() {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex flex-col gap-2">
        <CheckboxWithDescription
          id="controlled"
          title="Controlled checkbox"
          description="This checkbox is controlled by React state."
          checked={checked}
          onCheckedChange={setChecked}
        />
        <span className="text-xs text-[#888]">
          Checked: {checked ? 'true' : 'false'}
        </span>
      </div>
    );
  },
};

/**
 * Multiple checkboxes with descriptions in a settings-like layout.
 */
export const SettingsGroup: Story = {
  args: {
    id: 'settings',
    title: 'Settings',
    description: 'Group of settings',
    checked: false,
    onCheckedChange: () => {},
  },
  render: function SettingsGroup() {
    const [notifications, setNotifications] = useState(true);
    const [analytics, setAnalytics] = useState(false);
    const [autoUpdate, setAutoUpdate] = useState(true);

    return (
      <div className="flex flex-col gap-3">
        <CheckboxWithDescription
          id="notifications"
          title="Email notifications"
          description="Receive email alerts for critical events and updates."
          checked={notifications}
          onCheckedChange={setNotifications}
        />
        <CheckboxWithDescription
          id="analytics"
          title="Usage analytics"
          description="Help improve the product by sharing anonymous usage data."
          checked={analytics}
          onCheckedChange={setAnalytics}
        />
        <CheckboxWithDescription
          id="auto-update"
          title="Automatic updates"
          description="Automatically install updates when they become available."
          checked={autoUpdate}
          onCheckedChange={setAutoUpdate}
        />
      </div>
    );
  },
};

/**
 * All checkbox with description states displayed together.
 */
export const AllVariants: Story = {
  args: {
    id: 'all',
    title: 'All variants',
    description: 'All variants displayed together',
    checked: false,
    onCheckedChange: () => {},
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <CheckboxWithDescription
        id="unchecked"
        title="Unchecked"
        description="Default unchecked state"
        checked={false}
        onCheckedChange={() => {}}
      />
      <CheckboxWithDescription
        id="checked"
        title="Checked"
        description="Checked state with checkmark visible"
        checked={true}
        onCheckedChange={() => {}}
      />
      <CheckboxWithDescription
        id="disabled-unchecked"
        title="Disabled"
        description="Disabled state cannot be interacted with"
        checked={false}
        disabled
        onCheckedChange={() => {}}
      />
      <CheckboxWithDescription
        id="disabled-checked"
        title="Disabled Checked"
        description="Disabled but in checked state"
        checked={true}
        disabled
        onCheckedChange={() => {}}
      />
    </div>
  ),
};
