import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ParallaxImageShowcase } from '../components/features/parallax-image-showcase'

/** Generate a placeholder screenshot SVG as a data URI */
const makePlaceholder = (label: string, bg = '#1e1e2e', fg = '#a6adc8') =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">` +
    `<rect width="800" height="500" rx="12" fill="${bg}"/>` +
    `<rect x="16" y="16" width="768" height="40" rx="8" fill="${fg}" opacity="0.15"/>` +
    `<circle cx="36" cy="36" r="6" fill="#f38ba8"/>` +
    `<circle cx="56" cy="36" r="6" fill="#f9e2af"/>` +
    `<circle cx="76" cy="36" r="6" fill="#a6e3a1"/>` +
    `<rect x="16" y="72" width="200" height="412" rx="8" fill="${fg}" opacity="0.08"/>` +
    `<rect x="232" y="72" width="552" height="200" rx="8" fill="${fg}" opacity="0.08"/>` +
    `<rect x="232" y="288" width="268" height="196" rx="8" fill="${fg}" opacity="0.08"/>` +
    `<rect x="516" y="288" width="268" height="196" rx="8" fill="${fg}" opacity="0.08"/>` +
    `<text x="400" y="260" text-anchor="middle" fill="${fg}" font-size="20" font-family="sans-serif" opacity="0.5">${label}</text>` +
    `</svg>`
  )}`

const images = [
  { src: makePlaceholder('Dashboard', '#1e1e2e'), alt: 'Dashboard', position: 'left' as const },
  { src: makePlaceholder('Analytics', '#1a1b26'), alt: 'Analytics', position: 'center' as const },
  { src: makePlaceholder('Settings', '#191724'), alt: 'Settings', position: 'right' as const },
]

const meta = {
  title: 'Features/ParallaxImageShowcase',
  component: ParallaxImageShowcase,
  argTypes: {
    layout: {
      control: 'select',
      options: ['non-boxed', 'boxed', 'grid'],
    },
    intensity: {
      control: { type: 'number', min: 0, max: 10, step: 0.1 },
    },
    shadow: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ height: '200vh', paddingTop: '10vh' }}>
        <div style={{ height: '600px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ParallaxImageShowcase>

export default meta
type Story = StoryObj<typeof meta>

// === Layout Variants ===

/**
 * Default non-boxed layout with three overlapping layers and parallax depth.
 */
export const NonBoxed: Story = {
  args: {
    images,
    layout: 'non-boxed',
  },
}

/**
 * Boxed layout with two-row structure — logo on top, images below.
 */
export const Boxed: Story = {
  args: {
    images,
    layout: 'boxed',
    logoElement: (
      <div style={{ padding: '12px 24px', background: '#313244', borderRadius: 8, color: '#cdd6f4', fontFamily: 'monospace', fontSize: 18, fontWeight: 600 }}>
        Logo
      </div>
    ),
  },
}

/**
 * Grid layout — simple 3-column grid with gentle parallax.
 */
export const Grid: Story = {
  args: {
    images,
    layout: 'grid',
  },
}

// === Intensity Variants ===

/**
 * Subtle animation — barely noticeable movement.
 */
export const SubtleIntensity: Story = {
  args: {
    images,
    layout: 'non-boxed',
    intensity: 0.3,
  },
}

/**
 * Aggressive animation — exaggerated movement.
 */
export const HighIntensity: Story = {
  args: {
    images,
    layout: 'non-boxed',
    intensity: 5,
  },
}

// === Grid Options ===

/**
 * Grid layout with shadow enabled on each image.
 */
export const GridWithShadow: Story = {
  args: {
    images,
    layout: 'grid',
    shadow: true,
  },
}

/**
 * Grid with higher intensity for more dramatic parallax.
 */
export const GridHighIntensity: Story = {
  args: {
    images,
    layout: 'grid',
    intensity: 3,
    shadow: true,
  },
}

// === Partial Images ===

/**
 * Only two images provided (left + center).
 */
export const TwoImages: Story = {
  args: {
    images: images.slice(0, 2),
    layout: 'non-boxed',
  },
}

/**
 * Single image only.
 */
export const SingleImage: Story = {
  args: {
    images: [images[0]],
    layout: 'grid',
  },
}
