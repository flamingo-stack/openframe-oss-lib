import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OSTypeBadge, OSTypeIcon, OSTypeLabel } from '../components/features/os-type-badge';

const meta = {
  title: 'Features/OSTypeBadge',
  component: OSTypeBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays operating system type with icon and label. Automatically normalizes OS type strings from various sources like Fleet MDM, Tactical RMM, etc.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    osType: {
      control: 'select',
      options: ['windows', 'macos', 'linux', 'Darwin', 'Ubuntu', 'win32'],
      description: 'OS type string (case-insensitive, handles aliases)',
    },
    iconOnly: {
      control: 'boolean',
      description: 'Show only icon (no label)',
    },
    labelOnly: {
      control: 'boolean',
      description: 'Show label only (no icon)',
    },
    iconSize: {
      control: 'text',
      description: 'Icon size class (default: w-4 h-4)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof OSTypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default OSTypeBadge with Windows OS.
 */
export const Default: Story = {
  args: {
    osType: 'windows',
  },
};

/**
 * OSTypeBadge showing Windows.
 */
export const Windows: Story = {
  args: {
    osType: 'windows',
  },
};

/**
 * OSTypeBadge showing macOS.
 */
export const MacOS: Story = {
  args: {
    osType: 'macos',
  },
};

/**
 * OSTypeBadge showing macOS from Darwin alias.
 */
export const Darwin: Story = {
  args: {
    osType: 'Darwin',
  },
};

/**
 * OSTypeBadge showing Linux.
 */
export const Linux: Story = {
  args: {
    osType: 'linux',
  },
};

/**
 * OSTypeBadge showing Linux from Ubuntu alias.
 */
export const Ubuntu: Story = {
  args: {
    osType: 'Ubuntu',
  },
};

/**
 * Icon only mode - displays just the OS icon without label.
 */
export const IconOnly: Story = {
  args: {
    osType: 'windows',
    iconOnly: true,
  },
};

/**
 * Label only mode - displays just the OS label without icon.
 */
export const LabelOnly: Story = {
  args: {
    osType: 'macos',
    labelOnly: true,
  },
};

/**
 * Custom icon size.
 */
export const LargeIcon: Story = {
  args: {
    osType: 'linux',
    iconSize: 'w-6 h-6',
  },
};

/**
 * Unknown or missing OS type.
 */
export const Unknown: Story = {
  args: {
    osType: undefined,
    labelOnly: true,
  },
};

/**
 * All OS types displayed together for comparison.
 */
export const AllOSTypes: Story = {
  args: {
    osType: 'windows',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <OSTypeBadge osType="windows" />
      <OSTypeBadge osType="macos" />
      <OSTypeBadge osType="linux" />
    </div>
  ),
};

/**
 * All OS types with aliases showing normalization.
 */
export const Aliases: Story = {
  args: {
    osType: 'windows',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '80px', fontSize: '12px', color: '#666' }}>Darwin:</span>
        <OSTypeBadge osType="Darwin" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '80px', fontSize: '12px', color: '#666' }}>win32:</span>
        <OSTypeBadge osType="win32" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '80px', fontSize: '12px', color: '#666' }}>Ubuntu:</span>
        <OSTypeBadge osType="Ubuntu" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ width: '80px', fontSize: '12px', color: '#666' }}>Fedora:</span>
        <OSTypeBadge osType="Fedora" />
      </div>
    </div>
  ),
};

// OSTypeIcon Stories
const iconMeta = {
  title: 'Features/OSTypeIcon',
  component: OSTypeIcon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays only the OS icon without label. Convenience wrapper for OSTypeBadge with iconOnly prop.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OSTypeIcon>;

type IconStory = StoryObj<typeof iconMeta>;

/**
 * OSTypeIcon component - shows all OS icons.
 */
export const Icons: IconStory = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <OSTypeIcon osType="windows" />
      <OSTypeIcon osType="macos" />
      <OSTypeIcon osType="linux" />
    </div>
  ),
};

/**
 * OSTypeIcon with custom sizes.
 */
export const IconSizes: IconStory = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <OSTypeIcon osType="windows" size="w-3 h-3" />
      <OSTypeIcon osType="windows" size="w-4 h-4" />
      <OSTypeIcon osType="windows" size="w-5 h-5" />
      <OSTypeIcon osType="windows" size="w-6 h-6" />
      <OSTypeIcon osType="windows" size="w-8 h-8" />
    </div>
  ),
};

// OSTypeLabel Stories
const labelMeta = {
  title: 'Features/OSTypeLabel',
  component: OSTypeLabel,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays only the OS label without icon. Convenience wrapper for OSTypeBadge with labelOnly prop.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OSTypeLabel>;

type LabelStory = StoryObj<typeof labelMeta>;

/**
 * OSTypeLabel component - shows all OS labels.
 */
export const Labels: LabelStory = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <OSTypeLabel osType="windows" />
      <OSTypeLabel osType="macos" />
      <OSTypeLabel osType="linux" />
    </div>
  ),
};
