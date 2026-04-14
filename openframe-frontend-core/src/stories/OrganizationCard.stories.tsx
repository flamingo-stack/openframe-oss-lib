import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Trash2, DollarSign, Server } from 'lucide-react'
import { OrganizationCard, type Organization } from '../components/ui/organization-card'

const meta = {
  title: 'UI/OrganizationCard',
  component: OrganizationCard,
  parameters: {
    docs: {
      description: {
        component: 'A card component for displaying organizations with logo, description, stats, and optional link navigation.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    organization: {
      control: 'object',
      description: 'Organization data object',
    },
    href: {
      control: 'text',
      description: 'Link URL. When provided the card becomes a clickable link.',
    },
    fetchedImageUrl: {
      control: 'text',
      description: 'Pre-fetched image URL (from useBatchImages)',
    },
    deviceCount: {
      control: 'number',
      description: 'Device count displayed in top-right corner',
    },
    showActionButton: {
      control: 'boolean',
      description: 'Show action button in top-right',
    },
  },
} satisfies Meta<typeof OrganizationCard>

export default meta
type Story = StoryObj<typeof meta>

const baseOrg: Organization = {
  id: '1',
  name: 'Acme Corporation',
  industry: 'Technology',
  description: 'Leading provider of cloud infrastructure and managed services for enterprise clients worldwide.',
  totalDevices: 142,
  activeDevices: 138,
  mrrUsd: 12500,
}

/**
 * Default organization card.
 */
export const Default: Story = {
  args: {
    organization: baseOrg,
  },
}

/**
 * Card as a clickable link.
 */
export const WithLink: Story = {
  args: {
    organization: baseOrg,
    href: '/organizations/details/1',
  },
}

/**
 * Card with device count badge.
 */
export const WithDeviceCount: Story = {
  args: {
    organization: baseOrg,
    href: '/organizations/details/1',
    deviceCount: 142,
  },
}

/**
 * Card with footer stats.
 */
export const WithFooterStats: Story = {
  args: {
    organization: baseOrg,
    href: '/organizations/details/1',
    footerStats: [
      { icon: <Server className="h-4 w-4 text-ods-text-secondary" />, value: 142, label: 'devices' },
      { icon: <DollarSign className="h-4 w-4 text-ods-text-secondary" />, value: '$12,500', label: 'MRR' },
    ],
  },
}

/**
 * Card with action button.
 */
export const WithActionButton: Story = {
  args: {
    organization: baseOrg,
    showActionButton: true,
    actionButton: {
      icon: <Trash2 className="h-4 w-4" />,
      label: 'Remove',
      onClick: (org) => console.log('Remove:', org.id),
    },
  },
}

/**
 * Card with primary action button variant.
 */
export const WithPrimaryAction: Story = {
  args: {
    organization: baseOrg,
    showActionButton: true,
    actionButton: {
      icon: <Server className="h-4 w-4" />,
      label: 'Deploy',
      onClick: (org) => console.log('Deploy:', org.id),
      variant: 'primary',
    },
  },
}

/**
 * Minimal card with just a name.
 */
export const Minimal: Story = {
  args: {
    organization: {
      id: '2',
      name: 'Startup Inc',
    },
  },
}

/**
 * Card without description.
 */
export const NoDescription: Story = {
  args: {
    organization: {
      id: '3',
      name: 'CloudOps Ltd',
      industry: 'Cloud Services',
      tier: 'Enterprise',
    },
    href: '/organizations/details/3',
    deviceCount: 57,
  },
}

/**
 * Card with custom footer.
 */
export const WithCustomFooter: Story = {
  args: {
    organization: baseOrg,
    href: '/organizations/details/1',
    customFooter: (
      <div className="flex items-center gap-2 pt-2 border-t border-ods-border">
        <span className="text-sm text-ods-text-secondary">Custom footer content</span>
      </div>
    ),
  },
}