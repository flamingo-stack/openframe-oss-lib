import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  VideoBitesStrip,
  type VideoBiteStripItem,
} from '../components/features/video-bites-strip'

// Public-domain sample clips (Google CDN test media) — small MP4s so the
// hover-mount preview is exercised realistically in Storybook.
const SAMPLE_MP4 =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
const SAMPLE_MP4_2 =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'

const bite = (over: Partial<VideoBiteStripItem>): VideoBiteStripItem => ({
  url: SAMPLE_MP4,
  title: 'How an MSSP Director Tests Agentic AI for Regulated Law Firms',
  published: true,
  aspect_ratio: '9:16',
  created_at: '2026-07-01T00:00:00Z',
  thumbnail_url: 'https://picsum.photos/seed/bite/270/480',
  ...over,
})

const PROFILE = {
  name: 'Michael Crisafio',
  avatarUrl: 'https://picsum.photos/seed/avatar/68/68',
  subtitle: 'Tier 1 Consulting',
}

const MANY_MIXED: VideoBiteStripItem[] = [
  bite({ title: 'Portrait clip A', href: '#a' }),
  bite({ url: SAMPLE_MP4_2, title: 'Landscape clip', aspect_ratio: '16:9', thumbnail_url: 'https://picsum.photos/seed/land/480/270', href: '#b' }),
  bite({ title: 'Square clip', aspect_ratio: '1:1', thumbnail_url: 'https://picsum.photos/seed/sq/360/360' }),
  bite({ title: 'No-thumbnail clip (PlayIcon fallback)', thumbnail_url: undefined }),
  bite({ title: 'Portrait clip B', thumbnail_url: 'https://picsum.photos/seed/b2/270/480' }),
  bite({ title: 'Portrait clip C', thumbnail_url: 'https://picsum.photos/seed/b3/270/480' }),
  bite({ title: 'Portrait clip D', thumbnail_url: 'https://picsum.photos/seed/b4/270/480' }),
]

const meta: Meta<typeof VideoBitesStrip> = {
  title: 'Features/VideoBitesStrip',
  component: VideoBitesStrip,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="bg-ods-bg p-8 min-h-[560px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof VideoBitesStrip>

/** Mixed ratios at uniform height — the marquee engages once content overflows. */
export const MixedRatiosMarquee: Story = {
  args: { bites: MANY_MIXED, profile: PROFILE },
}

/** Two bites — no overflow, so no clones, no marquee, no chevrons. */
export const TwoBitesNoMarquee: Story = {
  args: { bites: MANY_MIXED.slice(0, 2), profile: PROFILE },
}

/** Missing thumbnails fall back to bg-ods-card + PlayIcon; preview still mounts on hover. */
export const NoThumbnails: Story = {
  args: {
    bites: MANY_MIXED.map(b => ({ ...b, thumbnail_url: undefined })),
    profile: PROFILE,
  },
}

/** autoScroll off — plain scrollable row with chevrons (reduced-motion behaves the same). */
export const AutoScrollDisabled: Story = {
  args: { bites: MANY_MIXED, autoScroll: false, profile: PROFILE },
}

/** Unpublished bites are filtered by default — this renders nothing (returns null). */
export const AllUnpublishedRendersNull: Story = {
  args: { bites: MANY_MIXED.map(b => ({ ...b, published: false })) },
}
