import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { ScriptArguments, type ScriptArgument } from '../components/platform/ScriptArguments'

const meta = {
  title: 'Platform/ScriptArguments',
  component: ScriptArguments,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Displays and manages script arguments as key-value pairs. Each argument has a name (key) and value input field with delete button. Includes an "Add Script Argument" button to add new entries.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    arguments: {
      control: 'object',
      description: 'Array of script arguments with id, key, and value'
    },
    onArgumentsChange: {
      action: 'argumentsChanged',
      description: 'Callback when arguments change'
    },
    keyPlaceholder: {
      control: 'text',
      description: 'Placeholder for key input'
    },
    valuePlaceholder: {
      control: 'text',
      description: 'Placeholder for value input'
    },
    addButtonLabel: {
      control: 'text',
      description: 'Label for the add button'
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the component is disabled'
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    }
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ScriptArguments>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default ScriptArguments with example data matching the Figma design.
 */
export const Default: Story = {
  args: {
    arguments: [
      { id: '1', key: 'port', value: '3000' },
      { id: '2', key: 'verbose', value: '' },
      { id: '3', key: 'config', value: 'production' }
    ],
    titleLabel: 'Script Arguments'
  }
}

/**
 * Empty state - no arguments yet.
 */
export const Empty: Story = {
  args: {
    arguments: [],
    titleLabel: 'Script Arguments'
  }
}

/**
 * Single argument.
 */
export const SingleArgument: Story = {
  args: {
    arguments: [{ id: '1', key: 'debug', value: 'true' }],
    titleLabel: 'Script Arguments'
  }
}

/**
 * Arguments with flags (empty values).
 */
export const WithFlags: Story = {
  args: {
    arguments: [
      { id: '1', key: '--verbose', value: '' },
      { id: '2', key: '--dry-run', value: '' },
      { id: '3', key: '--force', value: '' }
    ],
    titleLabel: 'Script Arguments'
  }
}

/**
 * Many arguments to show scrolling behavior.
 */
export const ManyArguments: Story = {
  args: {
    arguments: [
      { id: '1', key: 'host', value: 'localhost' },
      { id: '2', key: 'port', value: '8080' },
      { id: '3', key: 'database', value: 'mydb' },
      { id: '4', key: 'user', value: 'admin' },
      { id: '5', key: 'password', value: '********' },
      { id: '6', key: 'timeout', value: '30000' },
      { id: '7', key: 'retries', value: '3' }
    ],
    titleLabel: 'Script Arguments'
  }
}

/**
 * Disabled state.
 */
export const Disabled: Story = {
  args: {
    arguments: [
      { id: '1', key: 'port', value: '3000' },
      { id: '2', key: 'config', value: 'production' }
    ],
    disabled: true,
    titleLabel: 'Script Arguments'
  }
}

/**
 * Custom placeholders.
 */
export const CustomPlaceholders: Story = {
  args: {
    arguments: [{ id: '1', key: '', value: '' }],
    keyPlaceholder: 'Argument name',
    valuePlaceholder: 'Argument value',
    titleLabel: 'Script Arguments'
  }
}

/**
 * Custom add button label.
 */
export const CustomAddLabel: Story = {
  args: {
    arguments: [],
    addButtonLabel: 'Add New Parameter',
    titleLabel: 'Script Arguments'
  }
}

/**
 * Interactive example with state management.
 */
export const Interactive: Story = {
  args: {
    arguments: [],
    titleLabel: 'Script Arguments'
  },
  render: function InteractiveStory() {
    const [args, setArgs] = useState<ScriptArgument[]>([
      { id: '1', key: 'port', value: '3000' },
      { id: '2', key: 'verbose', value: '' },
      { id: '3', key: 'config', value: 'production' }
    ])

    return (
      <div className="flex flex-col gap-4">
        <ScriptArguments arguments={args} onArgumentsChange={setArgs} titleLabel="Script Arguments" />
        <div className="p-4 bg-[#1a1a1a] rounded-[6px] border border-[#3a3a3a]">
          <p className="text-ods-text-secondary text-sm mb-2">Current State:</p>
          <pre className="text-ods-text-primary text-xs overflow-auto">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      </div>
    )
  }
}

/**
 * Long values that may need truncation.
 */
export const LongValues: Story = {
  args: {
    arguments: [
      {
        id: '1',
        key: 'connection-string',
        value:
          'mongodb+srv://user:password@cluster0.mongodb.net/database?retryWrites=true&w=majority'
      },
      {
        id: '2',
        key: 'api-endpoint',
        value: 'https://api.example.com/v1/very/long/endpoint/path'
      }
    ],
    titleLabel: 'Script Arguments'
  }
}
