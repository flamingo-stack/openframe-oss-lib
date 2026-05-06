import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import { Arrow01RightIcon, ColorsIcon, PlusCircleIcon, PlayCircleIcon, CheckCircleIcon, PenEditIcon, CalendarDaysIcon, VialIcon, TerminalIcon, TrashIcon, ComputerMouseIcon, FolderIcon } from '../components/icons-v2-generated'
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'accent',
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
        variant: 'outline',
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
 * Two-target SplitButton — primary action on the left half, secondary action
 * (e.g. open in new tab) on the right half. Each half is independently clickable.
 */
export const SplitButtonTwoActions: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Open Docs',
        onClick: fn(),
        variant: 'accent',
        icon: <PlayCircleIcon size={24} />,
        iconAction: {
          icon: <Arrow01RightIcon size={24} />,
          'aria-label': 'Open docs in new tab',
          href: 'https://example.com/docs',
          openInNewTab: true,
        },
      },
    ],
    menuActions: [
      {
        items: [
          {
            id: 'edit',
            label: 'Edit',
            onClick: fn(),
            icon: <PenEditIcon size={24} />,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Provide `iconAction` on an action to render it as a `SplitButton` (two independent click targets). Main half runs the primary `onClick`/`href`; the icon half runs its own action — typical use case is "open in new tab".',
      },
    },
  },
}

/**
 * Menu items with a secondary action — each row in the dropdown can have its
 * own 40px icon button on the right (with vertical divider). Matches the Figma
 * device-page menu where rows like "Remote Control" have an arrow that opens
 * the app in a new tab while the main row navigates inside the current page.
 */
export const MenuItemsWithIconAction: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Save Changes',
        onClick: fn(),
        variant: 'accent',
        icon: <CheckCircleIcon size={24} />,
      },
    ],
    menuActions: [
      {
        items: [
          {
            id: 'remote-control',
            label: 'Remote Control',
            href: '/devices/remote-control',
            icon: <ComputerMouseIcon size={24} />,
            iconAction: {
              icon: <Arrow01RightIcon size={24} />,
              'aria-label': 'Open Remote Control in new tab',
              href: '/devices/remote-control',
              openInNewTab: true,
            },
          },
          {
            id: 'file-manager',
            label: 'File Manager',
            href: '/devices/file-manager',
            icon: <FolderIcon size={24} />,
            iconAction: {
              icon: <Arrow01RightIcon size={24} />,
              'aria-label': 'Open File Manager in new tab',
              href: '/devices/file-manager',
              openInNewTab: true,
            },
          },
          {
            id: 'archive-device',
            label: 'Archive Device',
            onClick: fn(),
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
          'Add `iconAction` to any `ActionsMenuItem` to render an independent secondary button on the right of the row, separated by a vertical divider. Clicking the secondary action does not trigger the main row.',
      },
    },
  },
}

/**
 * Two SplitButton actions + a menu where some items have a secondary action.
 * Shows the full Figma device-page pattern in a single layout.
 */
export const DoubleActionsAndMixedMenu: Story = {
  args: {
    variant: 'menu-primary',
    actions: [
      {
        label: 'Open Docs',
        onClick: fn(),
        variant: 'accent',
        icon: <PlayCircleIcon size={24} />,
        iconAction: {
          icon: <Arrow01RightIcon size={24} />,
          'aria-label': 'Open docs in new tab',
          href: 'https://example.com/docs',
          openInNewTab: true,
        },
      },
      {
        label: 'Run Script',
        onClick: fn(),
        variant: 'outline',
        icon: <TerminalIcon size={24} />,
        // Whole button disabled — both halves locked.
        disabled: true,
        iconAction: {
          icon: <Arrow01RightIcon size={24} />,
          'aria-label': 'Run script in new window',
          onClick: fn(),
        },
      },
      {
        label: 'Test Script',
        onClick: fn(),
        variant: 'outline',
        icon: <VialIcon size={24} />,
        // Only the main half disabled — icon-half stays clickable.
        mainDisabled: true,
        iconAction: {
          icon: <Arrow01RightIcon size={24} />,
          'aria-label': 'Test script in new window',
          onClick: fn(),
        },
      },
      {
        label: 'Schedule',
        onClick: fn(),
        variant: 'outline',
        icon: <CalendarDaysIcon size={24} />,
        // Only the icon half disabled — main stays clickable.
        iconAction: {
          icon: <Arrow01RightIcon size={24} />,
          'aria-label': 'Open scheduler in new window',
          onClick: fn(),
          disabled: true,
        },
      },
    ],
    menuActions: [
      {
        items: [
          {
            id: 'remote-control',
            label: 'Remote Control',
            href: '/devices/remote-control',
            icon: <ComputerMouseIcon size={24} />,
            iconAction: {
              icon: <Arrow01RightIcon size={24} />,
              'aria-label': 'Open Remote Control in new tab',
              href: '/devices/remote-control',
              openInNewTab: true,
            },
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
          'Combined story: two SplitButton page-actions on desktop (each with its own secondary action), plus a "..." menu where "Remote Control" has a secondary "open in new tab" button on the right and "Delete Device" is a single-target row.',
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
        variant: 'accent',
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
