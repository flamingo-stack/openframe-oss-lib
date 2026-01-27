import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ComputerMouseIcon, ShareIcon, TrashBlankIcon } from '../components/icons-v2-generated';
import { MoreActionsMenu } from '../components/ui/more-actions-menu';
const meta = {
  title: 'UI/MoreActionsMenu',
  component: MoreActionsMenu,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Compact, reusable menu triggered by an ellipsis icon button. Built on top of Radix DropdownMenu used in the UI Kit.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    items: {
      description: 'Array of menu items to display',
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: 'Horizontal alignment of the dropdown menu',
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Side of the trigger where menu appears',
    },
    sideOffset: {
      control: 'number',
      description: 'Distance in pixels from the trigger',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the trigger button',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible label for the trigger button',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MoreActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default MoreActionsMenu with basic text items.
 */
export const Default: Story = {
  args: {
    items: [
      {
        label: 'Edit',
        onClick: fn(),
      },
      {
        label: 'Duplicate',
        onClick: fn(),
      },
      {
        label: 'Delete',
        onClick: fn(),
      },
    ],
  },
};

export const WithIcons: Story = {
  args: {
    items: [
      {
        label: 'Edit',
        onClick: fn(),
        icon: <ComputerMouseIcon />,
      },
      {
        label: 'Share',
        onClick: fn(),
        icon: <ShareIcon />,
      },
    ],
  },
};

export const WithDanger: Story = {
  args: {
    items: [
      {
        label: 'Delete',
        onClick: fn(),
        danger: true,
        icon: <TrashBlankIcon />,
      },
    ],
  },
};