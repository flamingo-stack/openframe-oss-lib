import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState, type ReactNode } from 'react'
import { Button } from '../components/ui/button'
import { StatusBadge } from '../components/ui/status-badge'
import { MobileNavPanel } from '../components/navigation/mobile-nav-panel'
import type { MobileNavConfig } from '../types/navigation'

const meta: Meta<typeof MobileNavPanel> = {
  title: 'Navigation/MobileNavPanel',
  component: MobileNavPanel,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof meta>

const baseSections: MobileNavConfig['sections'] = [
  {
    title: 'Product',
    items: [
      { id: 'home', label: 'Home', href: '#', isActive: true },
      { id: 'features', label: 'Features', href: '#' },
      { id: 'pricing', label: 'Pricing', href: '#' },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'blog', label: 'Blog', href: '#' },
      { id: 'podcasts', label: 'Podcasts', href: '#' },
    ],
  },
]

function PanelHarness({
  config,
  children,
}: {
  config: Omit<MobileNavConfig, 'onClose'>
  children?: ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="min-h-screen bg-ods-bg p-4">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open menu
      </Button>
      {children}
      <MobileNavPanel
        isOpen={open}
        config={{ ...config, onClose: () => setOpen(false) }}
      />
    </div>
  )
}

/** Default chrome (openmsp-style): bg-ods-card + border, auth footer. */
export const Default: Story = {
  render: function Render() {
    return (
      <PanelHarness
        config={{
          sections: baseSections,
          footer: (
            <Button className="w-full" variant="outline">
              Sign Up
            </Button>
          ),
        }}
      />
    )
  },
}

/** Flamingo-style custom chrome via config.className (mobileNavClassName knob). */
export const CustomChrome: Story = {
  render: function Render() {
    return (
      <PanelHarness
        config={{
          sections: baseSections,
          className: 'bg-ods-bg border border-ods-border',
        }}
      />
    )
  },
}

/** TMCG-style disabled auth footer with a status badge. */
export const DisabledFooter: Story = {
  render: function Render() {
    return (
      <PanelHarness
        config={{
          sections: baseSections,
          footer: (
            <Button className="w-full cursor-not-allowed opacity-75" variant="outline" disabled>
              <span className="flex items-center justify-center gap-2 w-full">
                Member Login
                <StatusBadge text="Coming Soon" variant="button" colorScheme="cyan" />
              </span>
            </Button>
          ),
        }}
      />
    )
  },
}

/**
 * Regression story for the reported bug shape: a SHORT visible viewport with
 * a long menu. The panel must fit inside the fold (svh-based max-height), the
 * footer must stay visible, and the list must scroll internally to the last
 * item. View in a ~660px-tall viewport (or the story's constrained frame).
 */
export const ShortViewportLongList: Story = {
  render: function Render() {
    const longSections: MobileNavConfig['sections'] = [
      {
        title: 'All entries',
        items: Array.from({ length: 30 }, (_, i) => ({
          id: `item-${i + 1}`,
          label: i === 29 ? 'Last entry (must be reachable)' : `Menu entry ${i + 1}`,
          href: '#',
        })),
      },
    ]

    return (
      <PanelHarness
        config={{
          sections: longSections,
          footer: (
            <Button className="w-full" variant="outline">
              Sign Up
            </Button>
          ),
        }}
      >
        <p className="mt-4 text-sm text-ods-text-secondary">
          Resize the viewport short (~660px): the footer stays pinned and the
          list scrolls to "Last entry".
        </p>
      </PanelHarness>
    )
  },
}
