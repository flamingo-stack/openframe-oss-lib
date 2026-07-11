import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Announcement } from '../types/announcement'
import { AnnouncementBar } from '../components/announcement-bar'
import { announcementDismissCookieName } from '../utils/announcement-storage'
import { getAppType } from '../utils/app-config'
import { EndpointsRuntimeContext, type EndpointsRuntime } from '../contexts/endpoints-runtime-context'

/**
 * Stories drive the bar through its real `initialAnnouncement` prop (the hub's
 * SSR-seed path) — no fetch mock needed; with no EndpointsRuntime provider
 * mounted the bar never fetches. The decorator clears any dismissal state left
 * by a previous interaction so every story starts visible.
 */
function clearDismissals() {
  const platform = getAppType()
  document.cookie = `${announcementDismissCookieName(platform)}=; path=/; max-age=0`
  Object.keys(localStorage).forEach((key) => {
    if (key.includes('-announcement-') && key.endsWith('-dismissed')) {
      localStorage.removeItem(key)
    }
  })
}

const now = new Date().toISOString()

const baseAnnouncement: Announcement = {
  id: 'story-1',
  title: 'New Feature Released',
  description: 'Check out our latest updates and improvements to the platform.',
  background_color: '#FFD951',
  icon_name: 'rocket',
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
          'A top-of-page announcement bar. The host seeds it with `initialAnnouncement` (SSR path) or lets it self-fetch via the endpoints runtime. Supports SVG/PNG icons, CTA buttons, contrast-aware text, animated dismiss, and responsive mobile layout.',
      },
    },
  },
  decorators: [
    (Story) => {
      clearDismissals()
      return <Story />
    },
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof AnnouncementBar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default announcement with an icon and description.
 */
export const Default: Story = {
  args: { initialAnnouncement: baseAnnouncement },
}

/**
 * Announcement with a CTA button.
 */
export const WithCTA: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-cta',
      title: 'OpenFrame v2.0 is here!',
      description: 'Explore the new dashboard, improved device management, and more.',
      background_color: '#FFD951',
      icon_name: 'star',
      cta_enabled: true,
      cta_text: 'Learn More',
      cta_url: 'https://example.com',
      cta_target: '_blank',
      cta_icon_name: 'rocket',
      cta_show_icon: true,
      cta_button_background_color: '#1A1A1A',
      cta_button_text_color: '#FFFFFF',
    },
  },
}

/**
 * Announcement with a CTA button that opens in the same tab.
 */
export const WithCTASameTab: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-cta-same',
      title: 'Scheduled Maintenance',
      description: 'We will perform maintenance on Saturday from 2:00 AM to 4:00 AM UTC.',
      background_color: '#FFE082',
      icon_name: 'info',
      cta_enabled: true,
      cta_text: 'View Status',
      cta_url: '/status',
      cta_target: '_self',
    },
  },
}

/**
 * Dark background — text flips to the light shade via pickReadableTextColor.
 */
export const DarkBackground: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-dark',
      title: 'Contrast-aware text',
      description: 'On a dark admin-chosen background the foreground goes light automatically.',
      background_color: '#1F2937',
      icon_name: 'megaphone',
    },
  },
}

/**
 * Announcement with a blue background.
 */
export const BlueBackground: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-blue',
      title: 'Join our Community',
      description: 'Connect with other MSPs and share best practices.',
      background_color: '#60A5FA',
      icon_name: 'megaphone',
    },
  },
}

/**
 * Announcement with a green background.
 */
export const GreenBackground: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-green',
      title: 'All Systems Operational',
      description: 'Everything is running smoothly. No issues detected.',
      background_color: '#86EFAC',
      icon_name: 'bell',
    },
  },
}

/**
 * Announcement with OpenFrame logo icon.
 */
export const WithOpenFrameLogo: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-logo',
      title: 'Welcome to OpenFrame',
      description: 'Your open-source IT infrastructure management platform.',
      background_color: '#FFD951',
      icon_name: 'openframe-logo',
      cta_enabled: true,
      cta_text: 'Get Started',
      cta_url: '/getting-started',
      cta_target: '_self',
      cta_button_background_color: '#000000',
      cta_button_text_color: '#FFD951',
    },
  },
}

/**
 * Announcement with a PNG icon.
 */
export const WithPNGIcon: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-png',
      title: 'Partner Program Launch',
      description: 'Become an OpenFrame certified partner and grow your business.',
      background_color: '#C4B5FD',
      icon_url: 'https://placehold.co/32x32/1a1a1a/white?text=OF',
    },
  },
}

/**
 * Long title and description to test truncation.
 */
export const LongContent: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-long',
      title: 'This is a very long announcement title that should be truncated on smaller screens to prevent layout issues',
      description:
        'This is an extremely long description that goes into great detail about the announcement. It should be truncated on the desktop view and hidden on mobile view to keep the bar compact and readable.',
      background_color: '#FCA5A5',
      icon_name: 'info',
      cta_enabled: true,
      cta_text: 'Read Full Announcement',
      cta_url: '/announcements/long',
      cta_target: '_self',
    },
  },
}

/**
 * previewMode — the admin live-preview path: render-only, inert dismiss,
 * no fetch and no storage side effects.
 */
export const PreviewMode: Story = {
  args: {
    initialAnnouncement: {
      ...baseAnnouncement,
      id: 'story-preview',
      title: 'Admin preview',
      description: 'Exactly the live bar, but inert: dismiss does nothing.',
    },
    previewMode: true,
  },
}

/**
 * No active announcement — the bar renders nothing.
 */
export const NoAnnouncement: Story = {
  args: { initialAnnouncement: null },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <p className="p-4 text-sm text-gray-500">
          No announcement is active — the bar renders nothing above this text.
        </p>
      </div>
    ),
  ],
}

/**
 * Client-only mode (no SSR) — the react-embedding-example structure: the
 * embedder mounts an EndpointsRuntime provider (announcementsUrl is a fixed
 * suffix under its one content base) and drops in a PROP-LESS bar. No
 * platform knob anywhere on the client: the proxied server resolves its own
 * platform via currentPlatform(). The decorator mocks the fetch.
 */
const embedEndpoints: EndpointsRuntime = {
  announcementsUrl: '/content/api/announcements/active',
  accessCode: { validateUrl: '/content/api/validate-access-code', consumeUrl: '/content/api/consume-access-code' },
  contactUrl: '/content/api/contact',
}

export const ClientOnlyEmbed: Story = {
  args: {},
  decorators: [
    (Story) => {
      const originalFetch = window.fetch
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = typeof input === 'string' ? input : input.toString()
        if (requestUrl.includes('/content/api/announcements/active')) {
          return new Response(
            JSON.stringify({
              announcement: {
                ...baseAnnouncement,
                id: 'story-embed',
                title: 'Client-only embed',
                description: 'Fetched on mount through the EndpointsRuntime provider, no SSR.',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return originalFetch(input, init)
      }) as typeof window.fetch
      return (
        <EndpointsRuntimeContext.Provider value={embedEndpoints}>
          <Story />
        </EndpointsRuntimeContext.Provider>
      )
    },
  ],
}
