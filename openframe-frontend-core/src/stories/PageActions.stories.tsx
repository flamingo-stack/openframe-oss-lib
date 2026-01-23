import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { ColorsIcon, PlusCircleIcon, PlayCircleIcon, CheckCircleIcon } from '../components/icons-v2-generated'
import { PageActions } from '../components/ui/page-actions'

const meta = {
  title: 'UI/PageActions',
  component: PageActions,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
PageActions component for displaying action buttons in page headers.

**Two variants:**
1. \`icon-buttons\` - Buttons with icons, collapses to dropdown menu on mobile
2. \`primary-buttons\` - Primary + outline buttons, fixed to bottom on mobile

Use with \`PageContainer\` headerActions prop for consistent page layouts.
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['icon-buttons', 'primary-buttons'],
      description: 'Layout variant for the action buttons',
    },
    actions: {
      description: 'Array of action buttons to display',
    },
    gap: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Gap between buttons',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the container',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'var(--ods-bg)', minHeight: '200px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageActions>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Icon buttons variant - used for list pages like Scripts.
 * Shows buttons with icons on desktop, collapses to MoreActionsMenu on mobile.
 */
export const IconButtons: Story = {
  args: {
    variant: 'icon-buttons',
    actions: [
      {
        label: 'Edit Categories',
        onClick: fn(),
        icon: <ColorsIcon size={24} />,
      },
      {
        label: 'Add Script',
        onClick: fn(),
        icon: <PlusCircleIcon size={24} />,
      },
    ],
  },
}

/**
 * Primary buttons variant - used for form/detail pages.
 * Shows primary + outline buttons on desktop, fixed bottom bar on mobile.
 */
export const PrimaryButtons: Story = {
  args: {
    variant: 'primary-buttons',
    actions: [
      {
        label: 'Save Script',
        onClick: fn(),
        variant: 'primary',
      },
      {
        label: 'Test Script',
        onClick: fn(),
        variant: 'outline',
      },
    ],
  },
}

/**
 * Primary buttons with icons
 */
export const PrimaryButtonsWithIcons: Story = {
  args: {
    variant: 'primary-buttons',
    actions: [
      {
        label: 'Save Changes',
        onClick: fn(),
        variant: 'primary',
        icon: <CheckCircleIcon size={24} />,
      },
      {
        label: 'Preview',
        onClick: fn(),
        variant: 'outline',
        icon: <PlayCircleIcon size={24} />,
      },
    ],
  },
}

/**
 * Single primary button
 */
export const SinglePrimaryButton: Story = {
  args: {
    variant: 'primary-buttons',
    actions: [
      {
        label: 'Create New',
        onClick: fn(),
        variant: 'primary',
        icon: <PlusCircleIcon size={24} />,
      },
    ],
  },
}

/**
 * Single icon button - shows as icon on mobile instead of collapsing to menu
 */
export const SingleIconButton: Story = {
  args: {
    variant: 'icon-buttons',
    actions: [
      {
        label: 'Add Script',
        onClick: fn(),
        icon: <PlusCircleIcon size={24} />,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'When there is only one action in icon-buttons variant, it displays as an icon button on mobile instead of collapsing to a MoreActionsMenu.',
      },
    },
  },
}

/**
 * Icon buttons with three actions
 */
export const ThreeIconButtons: Story = {
  args: {
    variant: 'icon-buttons',
    actions: [
      {
        label: 'Edit',
        onClick: fn(),
        icon: <ColorsIcon size={24} />,
      },
      {
        label: 'Preview',
        onClick: fn(),
        icon: <PlayCircleIcon size={24} />,
      },
      {
        label: 'Add',
        onClick: fn(),
        icon: <PlusCircleIcon size={24} />,
      },
    ],
  },
}

/**
 * With disabled and loading states
 */
export const WithStates: Story = {
  args: {
    variant: 'primary-buttons',
    actions: [
      {
        label: 'Saving...',
        onClick: fn(),
        variant: 'primary',
        loading: true,
      },
      {
        label: 'Cancel',
        onClick: fn(),
        variant: 'outline',
        disabled: true,
      },
    ],
  },
}

/**
 * Small gap between buttons
 */
export const SmallGap: Story = {
  args: {
    variant: 'icon-buttons',
    gap: 'sm',
    actions: [
      {
        label: 'Edit',
        onClick: fn(),
        icon: <ColorsIcon size={24} />,
      },
      {
        label: 'Add',
        onClick: fn(),
        icon: <PlusCircleIcon size={24} />,
      },
    ],
  },
}

/**
 * Large gap between buttons
 */
export const LargeGap: Story = {
  args: {
    variant: 'primary-buttons',
    gap: 'lg',
    actions: [
      {
        label: 'Save',
        onClick: fn(),
        variant: 'primary',
      },
      {
        label: 'Cancel',
        onClick: fn(),
        variant: 'outline',
      },
    ],
  },
}
