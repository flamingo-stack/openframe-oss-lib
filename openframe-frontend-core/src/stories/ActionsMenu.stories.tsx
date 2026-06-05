import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import {
  ArrowRightUpIcon,
  Copy01Icon,
  Download01Icon,
  EyeIcon,
  Link01Icon,
  PencilIcon,
  Settings01Icon,
  ShareIcon,
  StarIcon,
  TrashBlankIcon,
} from '../components/icons-v2-generated';
import {
  ActionsMenu,
  ActionsMenuDropdown,
  type ActionsMenuGroup,
} from '../components/ui/actions-menu';

const meta = {
  title: 'UI/ActionsMenu',
  component: ActionsMenu,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Grouped action menu rendered as a flat panel. Supports plain items, icons, checkboxes, submenus, separators, destructive (danger) rows, navigation links, and an optional secondary icon action on the right of a row. Use `ActionsMenu` to render the panel inline, or `ActionsMenuDropdown` to attach it to a trigger button (built on Radix DropdownMenu).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    groups: {
      description: 'Array of groups, each holding an array of menu items',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the menu panel',
    },
    onItemClick: {
      description: 'Fires when any item is activated',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          padding: '4rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A simple single-group menu with icons.
 */
export const Default: Story = {
  args: {
    groups: [
      {
        items: [
          { id: 'edit', label: 'Edit', icon: <PencilIcon />, onClick: fn() },
          { id: 'duplicate', label: 'Duplicate', icon: <Copy01Icon />, onClick: fn() },
          { id: 'share', label: 'Share', icon: <ShareIcon />, onClick: fn() },
        ],
      },
    ],
  },
};

/**
 * Multiple groups separated by a divider, with a destructive row in the last group.
 */
export const GroupedWithDanger: Story = {
  args: {
    groups: [
      {
        id: 'primary',
        separator: true,
        items: [
          { id: 'view', label: 'View details', icon: <EyeIcon />, onClick: fn() },
          { id: 'edit', label: 'Edit', icon: <PencilIcon />, onClick: fn() },
          { id: 'download', label: 'Download', icon: <Download01Icon />, onClick: fn() },
        ],
      },
      {
        id: 'destructive',
        items: [
          {
            id: 'delete',
            label: 'Delete',
            icon: <TrashBlankIcon />,
            danger: true,
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/**
 * Checkbox items keep the menu open on click and reflect a `checked` state.
 */
export const WithCheckboxes: Story = {
  args: {
    groups: [
      {
        items: [
          {
            id: 'starred',
            label: 'Starred',
            type: 'checkbox',
            checked: true,
            icon: <StarIcon />,
            onClick: fn(),
          },
          {
            id: 'archived',
            label: 'Archived',
            type: 'checkbox',
            checked: false,
            onClick: fn(),
          },
        ],
      },
    ],
  },
};

/**
 * A submenu expands a nested set of items on hover/focus. Submenus rely on the
 * Radix DropdownMenu root, so they must be rendered through `ActionsMenuDropdown`
 * (the inline `ActionsMenu` panel has no menu context).
 */
export const WithSubmenu: StoryObj<typeof ActionsMenuDropdown> = {
  render: (args) => <ActionsMenuDropdown {...args} />,
  args: {
    groups: [
      {
        items: [
          { id: 'edit', label: 'Edit', icon: <PencilIcon />, onClick: fn() },
          {
            id: 'share',
            label: 'Share',
            type: 'submenu',
            icon: <ShareIcon />,
            submenu: [
              { id: 'copy-link', label: 'Copy link', icon: <Link01Icon />, onClick: fn() },
              { id: 'share-via', label: 'Share via…', icon: <ShareIcon />, onClick: fn() },
            ],
          },
          { id: 'settings', label: 'Settings', icon: <Settings01Icon />, onClick: fn() },
        ],
      },
    ],
    onItemClick: fn(),
  },
};

/**
 * Disabled rows are non-interactive and dimmed.
 */
export const WithDisabledItem: Story = {
  args: {
    groups: [
      {
        items: [
          { id: 'edit', label: 'Edit', icon: <PencilIcon />, onClick: fn() },
          {
            id: 'duplicate',
            label: 'Duplicate (unavailable)',
            icon: <Copy01Icon />,
            disabled: true,
            onClick: fn(),
          },
          { id: 'share', label: 'Share', icon: <ShareIcon />, onClick: fn() },
        ],
      },
    ],
  },
};

/**
 * A row can carry a secondary icon action — a 40px button on the right with a
 * divider that is independently clickable (e.g. "open in new tab").
 */
export const WithSecondaryAction: Story = {
  args: {
    groups: [
      {
        items: [
          {
            id: 'doc',
            label: 'Open document',
            icon: <EyeIcon />,
            onClick: fn(),
            iconAction: {
              icon: <ArrowRightUpIcon className="w-5 h-5 text-ods-text-secondary" />,
              'aria-label': 'Open in new tab',
              href: 'https://example.com',
              openInNewTab: true,
            },
          },
        ],
      },
    ],
  },
};

const dropdownGroups: ActionsMenuGroup[] = [
  {
    id: 'primary',
    separator: true,
    items: [
      { id: 'view', label: 'View details', icon: <EyeIcon />, onClick: fn() },
      { id: 'edit', label: 'Edit', icon: <PencilIcon />, onClick: fn() },
      { id: 'duplicate', label: 'Duplicate', icon: <Copy01Icon />, onClick: fn() },
    ],
  },
  {
    id: 'destructive',
    items: [
      {
        id: 'delete',
        label: 'Delete',
        icon: <TrashBlankIcon />,
        danger: true,
        onClick: fn(),
      },
    ],
  },
];

/**
 * `ActionsMenuDropdown` attaches the menu to a default ellipsis trigger button.
 */
export const Dropdown: StoryObj<typeof ActionsMenuDropdown> = {
  render: (args) => <ActionsMenuDropdown {...args} />,
  args: {
    groups: dropdownGroups,
    onItemClick: fn(),
  },
};
