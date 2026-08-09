import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import {
  Copy01Icon,
  Download01Icon,
  PencilIcon,
  Settings01Icon,
  TrashBlankIcon,
} from '../components/icons-v2-generated';
import { DropdownButton } from '../components/ui/dropdown-button';

const meta = {
  title: 'UI/DropdownButton',
  component: DropdownButton,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [undefined, 'outline', 'accent', 'transparent', 'destructive', 'warning'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-80 items-start justify-center p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DropdownButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS = [
  { id: 'edit', label: 'Edit', icon: <PencilIcon />, onClick: fn() },
  { id: 'duplicate', label: 'Duplicate', icon: <Copy01Icon />, onClick: fn() },
  { id: 'delete', label: 'Delete', icon: <TrashBlankIcon />, danger: true, onClick: fn() },
];

/**
 * The default card-colored seam trigger — label and chevron separated by a
 * divider, whole surface one click target, chevron rotates while open.
 */
export const Default: Story = {
  args: {
    label: 'Actions',
    items: ITEMS,
  },
};

/**
 * The Button-styled trigger: `variant="outline"` renders a standard `Button`
 * (with leading icon and trailing chevron) so the dropdown matches sibling
 * buttons in the same row. `groups` gives separated item groups; the danger
 * row demonstrates the destructive treatment.
 */
export const ButtonTrigger: Story = {
  args: {
    label: 'Manage repo',
    variant: 'outline',
    icon: <Settings01Icon />,
    groups: [
      {
        id: 'primary',
        separator: true,
        items: [
          { id: 'edit', label: 'Edit rules', icon: <PencilIcon />, onClick: fn() },
          { id: 'export', label: 'Export config', icon: <Download01Icon />, onClick: fn() },
        ],
      },
      {
        id: 'danger',
        items: [{ id: 'remove', label: 'Remove repo', icon: <TrashBlankIcon />, danger: true, onClick: fn() }],
      },
    ],
    onCloseAutoFocus: (e: Event) => e.preventDefault(),
  },
};

/**
 * Loading state (Button-styled trigger only): the spinner replaces the
 * content in place and the menu cannot open while loading.
 */
export const Loading: Story = {
  args: {
    label: 'Manage repo',
    variant: 'outline',
    icon: <Settings01Icon />,
    loading: true,
    items: ITEMS,
  },
};

/**
 * Disabled — both trigger looks support it.
 */
export const Disabled: Story = {
  args: {
    label: 'Actions',
    disabled: true,
    items: ITEMS,
  },
};
