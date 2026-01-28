import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ShellTypeBadge } from '../components/platform/ShellTypeBadge';
import type { ShellType } from '../types/shell.types';

const meta = {
  title: 'Platform/ShellTypeBadge',
  component: ShellTypeBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays a badge for shell/script types with appropriate icon and label. Supports all Tactical RMM shell types.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    shellType: {
      control: 'select',
      options: [
        'POWERSHELL',
        'CMD',
        'BASH',
        'PYTHON',
        'NUSHELL',
        'DENO',
        'SHELL'
      ] as ShellType[],
      description: 'The type of shell to display',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof ShellTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default ShellTypeBadge with PowerShell type.
 */
export const Default: Story = {
  args: {
    shellType: 'POWERSHELL',
  },
};

/**
 * ShellTypeBadge showing PowerShell.
 */
export const PowerShell: Story = {
  args: {
    shellType: 'POWERSHELL',
  },
};

/**
 * ShellTypeBadge showing CMD/Batch.
 */
export const Cmd: Story = {
  args: {
    shellType: 'CMD',
  },
};

/**
 * ShellTypeBadge showing Bash.
 */
export const Bash: Story = {
  args: {
    shellType: 'BASH',
  },
};

/**
 * ShellTypeBadge showing Python.
 */
export const Python: Story = {
  args: {
    shellType: 'PYTHON',
  },
};

/**
 * ShellTypeBadge showing Nushell.
 */
export const Nushell: Story = {
  args: {
    shellType: 'NUSHELL',
  },
};

/**
 * ShellTypeBadge showing Deno.
 */
export const Deno: Story = {
  args: {
    shellType: 'DENO',
  },
};

/**
 * ShellTypeBadge showing generic Shell.
 */
export const Shell: Story = {
  args: {
    shellType: 'SHELL',
  },
};

/**
 * All shell types displayed together for comparison.
 */
export const AllShellTypes: Story = {
  args: {
    shellType: 'POWERSHELL',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ShellTypeBadge shellType="POWERSHELL" />
      <ShellTypeBadge shellType="CMD" />
      <ShellTypeBadge shellType="BASH" />
      <ShellTypeBadge shellType="PYTHON" />
      <ShellTypeBadge shellType="NUSHELL" />
      <ShellTypeBadge shellType="DENO" />
      <ShellTypeBadge shellType="SHELL" />
    </div>
  ),
};
