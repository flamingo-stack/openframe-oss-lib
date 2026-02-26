import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Textarea } from '../components/ui/textarea'

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    invalid: {
      control: 'boolean',
      description: 'Invalid / error state',
    },
    rows: {
      control: 'number',
      description: 'Number of visible text rows',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'var(--ods-bg)', maxWidth: '480px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default textarea with placeholder.
 */
export const Default: Story = {
  args: {
    placeholder: 'Enter description...',
  },
}

/**
 * Textarea with a pre-filled value.
 */
export const WithValue: Story = {
  args: {
    defaultValue: 'Comprehensive Linux system backup script supporting full, home, and system configuration backups with automated cleanup.',
  },
}

/**
 * Disabled textarea.
 */
export const Disabled: Story = {
  args: {
    placeholder: 'Cannot edit...',
    disabled: true,
  },
}

/**
 * Disabled textarea with value.
 */
export const DisabledWithValue: Story = {
  args: {
    defaultValue: 'This content is read-only.',
    disabled: true,
  },
}

/**
 * Textarea with custom row count.
 */
export const CustomRows: Story = {
  args: {
    placeholder: 'Write your notes here...',
    rows: 8,
  },
}

/**
 * Textarea with resize disabled.
 */
export const NoResize: Story = {
  args: {
    placeholder: 'Fixed height textarea...',
    className: '!resize-none',
  },
}

/**
 * Textarea in invalid/error state.
 */
export const Invalid: Story = {
  args: {
    placeholder: 'Enter description...',
    invalid: true,
  },
}

/**
 * Textarea with label.
 */
export const WithLabel: Story = {
  args: {
    placeholder: 'Enter description...',
    label: 'Description',
  },
}

/**
 * Textarea with label and error message.
 */
export const WithLabelAndError: Story = {
  args: {
    placeholder: 'Enter description...',
    label: 'Description',
    error: 'Description is required',
  },
}

/**
 * Textarea with label and value.
 */
export const WithLabelAndValue: Story = {
  args: {
    label: 'Notes',
    defaultValue: 'Comprehensive Linux system backup script.',
  },
}

/**
 * Textarea with error only (no label).
 */
export const WithErrorOnly: Story = {
  args: {
    placeholder: 'Enter description...',
    error: 'Field cannot be empty',
  },
}

/**
 * All textarea variants displayed together for comparison.
 */
export const AllVariants: Story = {
  args: {
    placeholder: 'Default',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Textarea placeholder="Default textarea" />
      <Textarea defaultValue="With pre-filled value" />
      <Textarea placeholder="Disabled" disabled />
      <Textarea placeholder="Invalid state" invalid />
      <Textarea placeholder="Custom rows" rows={8} />
      <Textarea placeholder="No resize" className="!resize-none" />
      <Textarea label="With Label" placeholder="Enter description..." />
      <Textarea label="With Error" placeholder="Enter description..." error="Description is required" />
      <Textarea label="Valid Value" defaultValue="Some text content" />
    </div>
  ),
}
