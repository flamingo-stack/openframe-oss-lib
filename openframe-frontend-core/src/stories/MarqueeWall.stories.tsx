import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MarqueeWall, useMarqueeSync } from '../components/ui/marquee-wall'

// Arbitrary-children demo content: simple lockup tiles (the wall is
// content-agnostic — chips, logos, feed rows all ride the same engine).
const TILES = [
  'Datto RMM',
  'ConnectWise',
  'HaloPSA',
  'SentinelOne',
  'Proofpoint',
  'Veeam',
  'Auvik',
  'IT Glue',
]

function Tile({ label }: { label: string }) {
  return (
    <div className="flex h-16 w-48 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-card text-h6 text-ods-text-secondary">
      {label}
    </div>
  )
}

const meta: Meta<typeof MarqueeWall> = {
  title: 'UI/MarqueeWall',
  component: MarqueeWall,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'THE endless-scroll wall container — a clipped area whose content loops as a marquee along either axis, fading where the clip cuts. Transform-driven on the shared `useMarqueeEngine` core (no inner scroller). Auto-static when the content fits or under `prefers-reduced-motion`. `useMarqueeSync` pins multiple walls to one position driver; `trackId` publishes live offsets for FLIP-morph coordination.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-ods-bg p-[var(--spacing-system-xl)]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof MarqueeWall>

/** Horizontal loop of arbitrary children with the default right fade. */
export const Horizontal: Story = {
  render: () => (
    <MarqueeWall fade="right" copyGap="var(--spacing-system-mf)" className="w-full" contentClassName="flex items-center gap-[var(--spacing-system-mf)]">
      {TILES.map(t => (
        <Tile key={t} label={t} />
      ))}
    </MarqueeWall>
  ),
}

/** Vertical loop (bottom fade → bottom→top travel) inside a height cap. */
export const Vertical: Story = {
  render: () => (
    <div className="w-64 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <MarqueeWall
        fade="bottom"
        fadeColor="var(--color-bg-card)"
        copyGap="var(--spacing-system-mf)"
        className="max-h-[240px]"
        contentClassName="flex flex-col gap-[var(--spacing-system-mf)]"
      >
        {TILES.map(t => (
          <Tile key={t} label={t} />
        ))}
      </MarqueeWall>
    </div>
  ),
}

/** Two walls pinned to ONE position driver via `useMarqueeSync` — scroll
 *  stays pixel-locked (the FreeTrialCTA resolve-strip mechanism). */
export const SyncedPair: Story = {
  render: function SyncedPairStory() {
    const sync = useMarqueeSync()
    return (
      <div className="flex flex-col gap-[var(--spacing-system-mf)]">
        {[0, 1].map(row => (
          <MarqueeWall
            key={row}
            sync={sync}
            axis="x"
            copyGap="var(--spacing-system-mf)"
            className="w-full"
            contentClassName="flex items-center gap-[var(--spacing-system-mf)]"
          >
            {TILES.map(t => (
              <Tile key={t} label={t} />
            ))}
          </MarqueeWall>
        ))}
      </div>
    )
  },
}

/** Plain mode — the consumer's opt-out: same wall, no motion, no fades. */
export const Plain: Story = {
  render: () => (
    <MarqueeWall mode="plain" className="w-full" contentClassName="flex items-center gap-[var(--spacing-system-mf)]">
      {TILES.map(t => (
        <Tile key={t} label={t} />
      ))}
    </MarqueeWall>
  ),
}

/** Reverse travel (content moves right) with a custom-size leading fade. */
export const Reversed: Story = {
  render: () => (
    <MarqueeWall
      reverse
      fade={['left', 'right']}
      fadeSize={{ left: 48 }}
      copyGap="var(--spacing-system-mf)"
      className="w-full"
      contentClassName="flex items-center gap-[var(--spacing-system-mf)]"
    >
      {TILES.map(t => (
        <Tile key={t} label={t} />
      ))}
    </MarqueeWall>
  ),
}
