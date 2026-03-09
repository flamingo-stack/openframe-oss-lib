import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test'
import { FileManagerActionBar } from '../components/ui/file-manager/file-manager-action-bar';

const meta = {
  title: 'UI/FileManagerActionBar',
  component: FileManagerActionBar,
  args: {
    onNewFolder: fn(),
    onCopy: fn(),
    onCut: fn(),
    onPaste: fn(),
    onUpload: fn(),
    onSelectAll: fn(),
  },
  argTypes: {
    canPaste: { control: 'boolean' },
    hasSelection: { control: 'boolean' },
  },
} satisfies Meta<typeof FileManagerActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - no selection, no clipboard content.
 */
export const Default: Story = {
  args: {},
};

/**
 * Files are selected - Copy and Cut buttons become enabled.
 */
export const WithSelection: Story = {
  args: {
    hasSelection: true,
  },
};

/**
 * Clipboard has content - Paste button becomes enabled.
 */
export const WithPasteAvailable: Story = {
  args: {
    canPaste: true,
  },
};

/**
 * Files selected and clipboard has content - all buttons enabled.
 */
export const AllEnabled: Story = {
  args: {
    hasSelection: true,
    canPaste: true,
  },
};
