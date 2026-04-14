import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Announcement } from '../types/announcement'
import { AnnouncementBar } from '../components/announcement-bar'

/**
 * Mock fetch so the component receives announcement data without a real API.
 * Also seeds localStorage so the bar isn't marked as dismissed.
 */
function mockAnnouncement(announcement: Announcement | null) {
  // Clear any previous dismiss flags
  if (announcement) {
    Object.keys(localStorage).forEach((key) => {
      if (key.includes(`announcement-${announcement.id}-dismissed`)) {
        localStorage.removeItem(key)
      }
    })
  }

  const originalFetch = window.fetch
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/announcements/active')) {
      return new Response(JSON.stringify({ announcement }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originalFetch(input, init)
  }) as typeof window.fetch

  return () => {
    window.fetch = originalFetch
  }
}

const now = new Date().toISOString()

const baseAnnouncement: Announcement = {
  id: 'story-1',
  title: 'New Feature Released',
  description: 'Check out our latest updates and improvements to the platform.',
  background_color: '#FFD951',
  icon_type: 'svg',
  icon_svg_name: 'rocket',
  platform_id: 'openframe',
  is_active: true,
  created_at: now,
  updated_at: now,
}

const meta = {
  title: 'Features/AnnouncementBar',
  component: AnnouncementBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A top-of-page announcement bar that fetches the active announcement from the API. Supports SVG/PNG icons, CTA buttons, dismiss functionality, and responsive mobile layout.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AnnouncementBar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default announcement with an icon and description.
 */
export const Default: Story = {
  decorators: [
    (Story) => {
      const cleanup = mockAnnouncement(baseAnnouncement)
      return (
        <>
          <Story />
          {/* cleanup on unmount is handled by storybook re-renders */}
        </>
      )
    },
  ],
}

/**
 * Announcement with a CTA button.
 */
export const WithCTA: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-cta',
        title: 'OpenFrame v2.0 is here!',
        description: 'Explore the new dashboard, improved device management, and more.',
        background_color: '#FFD951',
        icon_svg_name: 'star',
        cta_enabled: true,
        cta_text: 'Learn More',
        cta_url: 'https://example.com',
        cta_target: '_blank',
        cta_icon: 'rocket',
        cta_show_icon: true,
        cta_button_background_color: '#1A1A1A',
        cta_button_text_color: '#FFFFFF',
      })
      return <Story />
    },
  ],
}

/**
 * Announcement with a CTA button that opens in the same tab.
 */
export const WithCTASameTab: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-cta-same',
        title: 'Scheduled Maintenance',
        description: 'We will perform maintenance on Saturday from 2:00 AM to 4:00 AM UTC.',
        background_color: '#FFE082',
        icon_svg_name: 'info',
        cta_enabled: true,
        cta_text: 'View Status',
        cta_url: '/status',
        cta_target: '_self',
      })
      return <Story />
    },
  ],
}

/**
 * Announcement with a blue background.
 */
export const BlueBackground: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-blue',
        title: 'Join our Community',
        description: 'Connect with other MSPs and share best practices.',
        background_color: '#60A5FA',
        icon_svg_name: 'megaphone',
      })
      return <Story />
    },
  ],
}

/**
 * Announcement with a green background.
 */
export const GreenBackground: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-green',
        title: 'All Systems Operational',
        description: 'Everything is running smoothly. No issues detected.',
        background_color: '#86EFAC',
        icon_svg_name: 'bell',
      })
      return <Story />
    },
  ],
}

/**
 * Announcement with OpenFrame logo icon.
 */
export const WithOpenFrameLogo: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-logo',
        title: 'Welcome to OpenFrame',
        description: 'Your open-source IT infrastructure management platform.',
        background_color: '#FFD951',
        icon_svg_name: 'openframe-logo',
        cta_enabled: true,
        cta_text: 'Get Started',
        cta_url: '/getting-started',
        cta_target: '_self',
        cta_button_background_color: '#000000',
        cta_button_text_color: '#FFD951',
      })
      return <Story />
    },
  ],
}

/**
 * Announcement with a PNG icon.
 */
export const WithPNGIcon: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-png',
        title: 'Partner Program Launch',
        description: 'Become an OpenFrame certified partner and grow your business.',
        background_color: '#C4B5FD',
        icon_type: 'png',
        icon_png_url: 'https://placehold.co/32x32/1a1a1a/white?text=OF',
      })
      return <Story />
    },
  ],
}

/**
 * Long title and description to test truncation.
 */
export const LongContent: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement({
        ...baseAnnouncement,
        id: 'story-long',
        title: 'This is a very long announcement title that should be truncated on smaller screens to prevent layout issues',
        description:
          'This is an extremely long description that goes into great detail about the announcement. It should be truncated on the desktop view and hidden on mobile view to keep the bar compact and readable.',
        background_color: '#FCA5A5',
        icon_svg_name: 'info',
        cta_enabled: true,
        cta_text: 'Read Full Announcement',
        cta_url: '/announcements/long',
        cta_target: '_self',
      })
      return <Story />
    },
  ],
}

/**
 * No active announcement — the bar renders nothing.
 */
export const NoAnnouncement: Story = {
  decorators: [
    (Story) => {
      mockAnnouncement(null)
      return (
        <div>
          <Story />
          <p className="p-4 text-sm text-gray-500">
            No announcement is active — the bar renders nothing above this text.
          </p>
        </div>
      )
    },
  ],
}
