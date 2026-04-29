import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { ColorsIcon, PlusCircleIcon, PlayCircleIcon, CheckCircleIcon, PenEditIcon, CalendarDaysIcon, VialIcon, TerminalIcon, TrashIcon } from '../components/icons-v2-generated'
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
        items: [
          {
            id: 'edit-script',
            label: 'Edit Script',
            onClick: fn(),
            icon: <PenEditIcon size={24} />,
          },
          {
            id: 'schedule-script',
            label: 'Schedule Script',
            onClick: fn(),
            icon: <CalendarDaysIcon size={24} />,
          },
          {
            id: 'test-script',
            label: 'Test Script',
            onClick: fn(),
            icon: <VialIcon size={24} />,
          },
        ],
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
        items: [
          {
            id: 'delete',
            label: 'Delete',
            onClick: fn(),
          },
        ],
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
        items: [
          {
            id: 'edit-script',
            label: 'Edit Script',
            onClick: fn(),
            icon: <PenEditIcon size={24} />,
          },
          {
            id: 'schedule-script',
            label: 'Schedule Script',
            onClick: fn(),
            icon: <CalendarDaysIcon size={24} />,
          },
        ],
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
 * Link actions — any action can render as a Next.js `<Link>` by providing `href`.
 * The `<a>` element lands in the DOM (crawler-visible) and clicking routes
 * client-side. Mix freely with onClick-only actions; use `openInNewTab` for
 * external links.
 */
export const LinkActions: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Open Docs',
        href: '/docs',
        variant: 'primary',
        icon: <PlayCircleIcon size={24} />,
      },
    ],
    menuActions: [
      {
        items: [
          {
            id: 'github',
            label: 'GitHub',
            href: 'https://github.com/flamingo',
            icon: <PenEditIcon size={24} />,
          },
          {
            id: 'changelog',
            label: 'Changelog',
            href: '/changelog',
            icon: <CalendarDaysIcon size={24} />,
          },
          {
            id: 'run-diagnostics',
            label: 'Run Diagnostics',
            onClick: fn(),
            icon: <VialIcon size={24} />,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Primary action navigates to `/docs` via Next Link. Menu has two link actions (internal + external in new tab) and one onClick-only action. Inspect the DOM — link actions render as real `<a href>` inside the dropdown menu.',
      },
    },
  },
}

/**
 * Split button — a primary action with a chevron that opens a dropdown of
 * alternatives. Matches the Figma device-page pattern where "Remote Shell"
 * sits next to a "..." menu, and the chevron reveals CMD / Power Shell.
 *
 * On mobile everything collapses into a single "..." menu.
 */
export const SplitButtonWithMenu: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Remote Shell',
        variant: 'card',
        submenu: [
          {
            id: 'cmd',
            label: 'CMD',
            onClick: fn(),
            icon: <TerminalIcon size={24} />,
          },
          {
            id: 'power-shell',
            label: 'Power Shell',
            onClick: fn(),
            icon: <TerminalIcon size={24} />,
          },
        ],
      },
    ],
    menuActions: [
      {
        items: [
          {
            id: 'edit-device',
            label: 'Edit Device',
            onClick: fn(),
            icon: <PenEditIcon size={24} />,
          },
          {
            id: 'delete-device',
            label: 'Delete Device',
            onClick: fn(),
            icon: <TrashIcon size={24} />,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Provide `submenu` on an action to render a split button with a chevron that opens a dropdown of alternatives. On mobile the submenu items are flattened into the "..." menu alongside `menuActions`.',
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
