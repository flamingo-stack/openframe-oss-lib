import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { ColorsIcon, PlusCircleIcon, PlayCircleIcon, CheckCircleIcon, PenEditIcon, CalendarDaysIcon, VialIcon } from '../components/icons-v2-generated'
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

**Three variants:**
1. \`icon-buttons\` - Buttons with icons, collapses to dropdown menu on mobile
2. \`primary-buttons\` - Primary + outline buttons, fixed to bottom on mobile
3. \`menu-primary\` - MoreActionsMenu ("...") + primary button on desktop, all actions expand to fixed bottom bar on mobile

Use with \`PageContainer\` headerActions prop for consistent page layouts.
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['icon-buttons', 'primary-buttons', 'menu-primary'],
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

/**
 * Menu + primary variant - shows MoreActionsMenu ("...") + primary button on desktop.
 * On mobile all actions expand into a fixed bottom bar.
 */
export const MenuPrimary: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Run Script',
        onClick: fn(),
        variant: 'primary',
        icon: <PlayCircleIcon size={24} />,
      },
    ],
    menuActions: [
      {
        label: 'Edit Script',
        onClick: fn(),
        icon: <PenEditIcon size={24} />,
      },
      {
        label: 'Schedule Script',
        onClick: fn(),
        icon: <CalendarDaysIcon size={24} />,
      },
      {
        label: 'Test Script',
        onClick: fn(),
        icon: <VialIcon size={24} />,
      },
    ],
  },
}

/**
 * Menu + primary with a single menu action
 */
export const MenuPrimarySingleAction: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Save Changes',
        onClick: fn(),
        variant: 'primary',
        icon: <CheckCircleIcon size={24} />,
      },
    ],
    menuActions: [
      {
        label: 'Delete',
        onClick: fn(),
        danger: true,
      },
    ],
  },
}

/**
 * Menu + primary with loading state on the primary button
 */
export const MenuPrimaryLoading: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Running...',
        onClick: fn(),
        variant: 'primary',
        loading: true,
      },
    ],
    menuActions: [
      {
        label: 'Edit Script',
        onClick: fn(),
        icon: <PenEditIcon size={24} />,
      },
      {
        label: 'Schedule Script',
        onClick: fn(),
        icon: <CalendarDaysIcon size={24} />,
      },
    ],
  },
}

/**
 * Mobile-only actions with `showOnlyMobile` — some actions appear only on mobile.
 * "Edit Categories" is hidden on desktop and only shows in the mobile menu.
 */
export const MobileOnlyActions: Story = {
  args: {
    variant: 'icon-buttons',
    actions: [
      {
        label: 'Add Script',
        onClick: fn(),
        icon: <PlusCircleIcon size={24} />,
      },
      {
        label: 'Edit Categories',
        onClick: fn(),
        icon: <ColorsIcon size={24} />,
        showOnlyMobile: true,
      },
      {
        label: 'Preview',
        onClick: fn(),
        icon: <PlayCircleIcon size={24} />,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Use the `showOnlyMobile` prop to hide specific actions on desktop. They will still appear in the mobile menu or bottom bar.',
      },
    },
  },
}

/**
 * Primary buttons with a mobile-only action.
 */
export const PrimaryButtonsMobileOnly: Story = {
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
        label: 'Delete',
        onClick: fn(),
        variant: 'outline',
        showOnlyMobile: true,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'The "Delete" button only appears in the mobile bottom bar. On desktop only "Save Changes" is shown.',
      },
    },
  },
}
