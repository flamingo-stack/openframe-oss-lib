import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ToolBadge } from '../components/platform/ToolBadge';
import type { ToolType } from '../types/tool.types';

const meta = {
  title: 'Platform/ToolBadge',
  component: ToolBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays a tool type badge with icon for OpenFrame integrated tools. Used in tables to show tool sources like Tactical RMM, Fleet MDM, etc.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    toolType: {
      control: 'select',
      options: [
        'TACTICAL_RMM',
        'FLEET_MDM',
        'MESHCENTRAL',
        'AUTHENTIK',
        'OPENFRAME',
        'OPENFRAME_CHAT',
        'OPENFRAME_CLIENT',
        'SYSTEM'
      ] as ToolType[],
      description: 'The type of tool to display',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof ToolBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default ToolBadge with Tactical RMM type.
 */
export const Default: Story = {
  args: {
    toolType: 'TACTICAL_RMM',
  },
};

/**
 * ToolBadge showing Fleet MDM integration.
 */
export const Fleet: Story = {
  args: {
    toolType: 'FLEET_MDM',
  },
};

/**
 * ToolBadge showing MeshCentral integration.
 */
export const MeshCentral: Story = {
  args: {
    toolType: 'MESHCENTRAL',
  },
};

/**
 * ToolBadge showing Authentik integration.
 */
export const Authentik: Story = {
  args: {
    toolType: 'AUTHENTIK',
  },
};

/**
 * ToolBadge showing OpenFrame.
 */
export const OpenFrame: Story = {
  args: {
    toolType: 'OPENFRAME',
  },
};

/**
 * ToolBadge showing OpenFrame Chat.
 */
export const OpenFrameChat: Story = {
  args: {
    toolType: 'OPENFRAME_CHAT',
  },
};

/**
 * ToolBadge showing OpenFrame Client.
 */
export const OpenFrameClient: Story = {
  args: {
    toolType: 'OPENFRAME_CLIENT',
  },
};

/**
 * ToolBadge showing System.
 */
export const System: Story = {
  args: {
    toolType: 'SYSTEM',
  },
};

/**
 * All tool badges displayed together for comparison.
 */
export const AllTools: Story = {
  args: {
    toolType: 'OPENFRAME',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ToolBadge toolType="OPENFRAME" />
      <ToolBadge toolType="OPENFRAME_CHAT" />
      <ToolBadge toolType="OPENFRAME_CLIENT" />
    </div>
  ),
};

