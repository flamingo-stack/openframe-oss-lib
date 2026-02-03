import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ScriptInfoSection } from '../components/platform/ScriptInfoSection'
import type { ShellType } from '../types/shell.types'

const meta = {
  title: 'Platform/ScriptInfoSection',
  component: ScriptInfoSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Displays script information in a card with header (title, description) and detail cells (shell type, supported platforms, category, author). Responsive layout adapts to screen size.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    headline: {
      control: 'text',
      description: 'Script title/name'
    },
    subheadline: {
      control: 'text',
      description: 'Script description'
    },
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
      description: 'Shell type (POWERSHELL, BASH, CMD, etc.)'
    },
    supportedPlatforms: {
      control: 'object',
      description: 'Array of supported platform strings'
    },
    category: {
      control: 'text',
      description: 'Script category'
    },
    author: {
      control: 'object',
      description: 'Author information with name, initials, and photoUrl'
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    }
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ScriptInfoSection>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default ScriptInfoSection with all fields populated.
 */
export const Default: Story = {
  args: {
    headline: 'System Backup Script',
    subheadline:
      'Comprehensive Linux system backup script supporting full, home, and system configuration backups with compression, integrity verification, and automated cleanup',
    shellType: 'BASH',
    supportedPlatforms: ['linux'],
    category: 'System Maintenance',
    author: {
      name: 'John Doe',
      photoUrl: 'https://i.pravatar.cc/150?img=68'
    }
  }
}

/**
 * Script with PowerShell shell type for Windows.
 */
export const PowerShellScript: Story = {
  args: {
    headline: 'Windows Registry Cleanup',
    subheadline:
      'Cleans up obsolete registry entries and optimizes Windows performance',
    shellType: 'POWERSHELL',
    supportedPlatforms: ['windows'],
    category: 'System Optimization',
    author: {
      name: 'Alice Smith',
      initials: 'AS'
    }
  }
}

/**
 * Script supporting multiple platforms.
 */
export const MultiPlatform: Story = {
  args: {
    headline: 'Cross-Platform Installer',
    subheadline:
      'Universal installer script that works across Windows, macOS, and Linux',
    shellType: 'PYTHON',
    supportedPlatforms: ['windows', 'darwin', 'linux'],
    category: 'Installation',
    author: {
      name: 'Bob Johnson',
      photoUrl: 'https://i.pravatar.cc/150?img=12'
    }
  }
}

/**
 * Script with minimal information (no description, no author).
 */
export const Minimal: Story = {
  args: {
    headline: 'Quick Deploy',
    shellType: 'SHELL',
    supportedPlatforms: ['linux'],
    category: 'System Maintenance'
  }
}

/**
 * Script with long description that truncates.
 */
export const LongDescription: Story = {
  args: {
    headline: 'Enterprise Backup Solution',
    subheadline:
      'This comprehensive enterprise-grade backup solution provides incremental and full backup capabilities with support for local and cloud storage providers including AWS S3, Azure Blob Storage, and Google Cloud Storage. Features include encryption at rest and in transit, deduplication, compression, and detailed logging with email notifications.',
    shellType: 'BASH',
    supportedPlatforms: ['linux', 'darwin'],
    category: 'Backup & Recovery',
    author: {
      name: 'Enterprise Admin',
      initials: 'EA'
    }
  }
}

/**
 * Script without category field.
 */
export const WithoutCategory: Story = {
  args: {
    headline: 'Disk Cleanup Utility',
    subheadline: 'Removes temporary files and frees up disk space',
    shellType: 'CMD',
    supportedPlatforms: ['windows'],
    category: 'System Maintenance',
    author: {
      name: 'System Admin',
      photoUrl: 'https://i.pravatar.cc/150?img=3'
    }
  }
}

/**
 * Script with macOS only support.
 */
export const MacOSOnly: Story = {
  args: {
    headline: 'Xcode Cleanup',
    subheadline:
      'Removes derived data and archives to free up space on macOS development machines',
    shellType: 'BASH',
    supportedPlatforms: ['darwin'],
    category: 'Development',
    author: {
      name: 'Dev Ops',
      initials: 'DO'
    }
  }
}

/**
 * All platforms supported (when supportedPlatforms is empty or undefined).
 */
export const AllPlatforms: Story = {
  args: {
    headline: 'Universal Health Check',
    subheadline: 'Performs system health checks on any platform',
    shellType: 'PYTHON',
    supportedPlatforms: [],
    category: 'Monitoring',
    author: {
      name: 'Health Bot',
      initials: 'HB'
    }
  }
}

/**
 * Deno script example.
 */
export const DenoScript: Story = {
  args: {
    headline: 'API Testing Suite',
    subheadline: 'Automated API endpoint testing with Deno',
    shellType: 'DENO',
    supportedPlatforms: ['windows', 'darwin', 'linux'],
    category: 'Testing',
    author: {
      name: 'QA Team',
      initials: 'QA'
    }
  }
}

/**
 * Multiple scripts displayed together for visual comparison.
 */
export const MultipleScripts: Story = {
  args: {
    headline: 'System Backup Script',
    shellType: 'BASH',
    category: 'System Maintenance'
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <ScriptInfoSection
        headline="System Backup Script"
        subheadline="Comprehensive Linux system backup script"
        shellType="BASH"
        supportedPlatforms={['linux']}
        category="System Maintenance"
        author={{ name: 'John Doe', photoUrl: 'https://i.pravatar.cc/150?img=68' }}
      />
      <ScriptInfoSection
        headline="Windows Update Manager"
        subheadline="Manages Windows Update settings and schedules"
        shellType="POWERSHELL"
        supportedPlatforms={['windows']}
        category="System Updates"
        author={{ name: 'Admin User', initials: 'AU' }}
      />
      <ScriptInfoSection
        headline="Cross-Platform Logger"
        subheadline="Universal logging solution"
        shellType="PYTHON"
        supportedPlatforms={['windows', 'darwin', 'linux']}
        category="Logging"
        author={{ name: 'Dev Team', initials: 'DT' }}
      />
    </div>
  )
}
