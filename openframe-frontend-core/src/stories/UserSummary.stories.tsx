import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { UserSummary } from '../components/user-summary-stub'

/** Generate a square colored SVG avatar as a data URI */
const makeAvatar = (initials: string, bg = '#6366f1') =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="${bg}"/>` +
    `<text x="48" y="54" text-anchor="middle" fill="#fff" font-size="36" font-family="sans-serif">${initials}</text>` +
    `</svg>`
  )}`

const avatarJohn = makeAvatar('JD', '#6366f1')
const avatarJane = makeAvatar('JS', '#ec4899')
const avatarAlex = makeAvatar('AJ', '#14b8a6')
const avatarSarah = makeAvatar('SC', '#f59e0b')
const mspLogo = makeAvatar('S', '#161616')

const meta = {
  title: 'Components/UserSummary',
  component: UserSummary,
  argTypes: {
    compact: { control: 'boolean' },
    avatarSize: { control: { type: 'number', min: 24, max: 120 } },
    showEditButton: { control: 'boolean' },
    editablePhoto: { control: 'boolean' },
  },
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof UserSummary>

export default meta
type Story = StoryObj<typeof meta>

// === Default (Full) ===

/**
 * Default full-size variant with avatar and email.
 */
export const Default: Story = {
  args: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: avatarJohn,
  },
}

/**
 * Full variant without an avatar — shows initials fallback.
 */
export const NoAvatar: Story = {
  args: {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
  },
}

/**
 * Full variant with subtitle replacing the email line.
 */
export const WithSubtitle: Story = {
  args: {
    name: 'Alex Johnson',
    email: 'alex@example.com',
    avatarUrl: avatarAlex,
    subtitle: '3 hours ago',
  },
}

// === Auth Providers ===

/**
 * Shows auth provider icons (Google + Microsoft).
 */
export const WithAuthProviders: Story = {
  args: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: avatarJohn,
    authProviders: ['google', 'microsoft'],
  },
}

// === MSP Preview ===

/**
 * Full variant with MSP details and logo badge.
 */
export const WithMSP: Story = {
  args: {
    name: 'Sarah Connor',
    email: 'sarah@skynet-msp.com',
    avatarUrl: avatarSarah,
    mspPreview: {
      name: 'Skynet MSP',
      seatCount: 1200,
      technicianCount: 45,
      annualRevenue: 2_500_000,
      logoUrl: mspLogo,
    },
  },
}

/**
 * MSP preview without a logo — shows initial fallback on the badge.
 */
export const WithMSPNoLogo: Story = {
  args: {
    name: 'Sarah Connor',
    email: 'sarah@skynet-msp.com',
    avatarUrl: avatarSarah,
    mspPreview: {
      name: 'Skynet MSP',
      seatCount: 500,
      technicianCount: 12,
    },
  },
}

// === Edit Button ===

/**
 * Shows the edit profile indicator.
 */
export const WithEditButton: Story = {
  args: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: avatarJohn,
    showEditButton: true,
  },
}

// === Full Featured ===

/**
 * All features enabled: avatar, MSP, auth providers, edit button.
 */
export const FullFeatured: Story = {
  args: {
    name: 'Sarah Connor',
    email: 'sarah@skynet-msp.com',
    avatarUrl: avatarSarah,
    authProviders: ['google', 'microsoft'],
    showEditButton: true,
    mspPreview: {
      name: 'Skynet MSP',
      seatCount: 1200,
      technicianCount: 45,
      annualRevenue: 2_500_000,
      logoUrl: mspLogo,
    },
  },
}

// === Compact Variant ===

/**
 * Compact mode — minimal horizontal row for comment headers.
 */
export const Compact: Story = {
  args: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: avatarJohn,
    compact: true,
  },
}

/**
 * Compact mode without avatar.
 */
export const CompactNoAvatar: Story = {
  args: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    compact: true,
  },
}

/**
 * Compact mode with subtitle instead of email.
 */
export const CompactWithSubtitle: Story = {
  args: {
    name: 'Alex Johnson',
    email: 'alex@example.com',
    avatarUrl: avatarAlex,
    compact: true,
    subtitle: '5 minutes ago',
  },
}

/**
 * Compact mode with MSP badge.
 */
export const CompactWithMSP: Story = {
  args: {
    name: 'Sarah Connor',
    email: 'sarah@skynet-msp.com',
    avatarUrl: avatarSarah,
    compact: true,
    mspPreview: {
      name: 'Skynet MSP',
      logoUrl: mspLogo,
    },
  },
}

/**
 * Compact mode with a custom larger avatar size.
 */
export const CompactLargeAvatar: Story = {
  args: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatarUrl: avatarJohn,
    compact: true,
    avatarSize: 64,
  },
}
