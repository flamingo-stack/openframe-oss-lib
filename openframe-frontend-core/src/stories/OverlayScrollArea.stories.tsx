import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { OverlayScrollArea } from '../components/ui/overlay-scroll-area'

// POC: standardized macOS-like overlay scrollbar (OverlayScrollbars) — the
// bar appears while scrolling / hovering and fades out when idle, on every
// platform. Native scrolling (wheel, touchpad momentum, thumb drag) is kept.

const meta: Meta<typeof OverlayScrollArea> = {
  title: 'UI/OverlayScrollArea',
  component: OverlayScrollArea,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof OverlayScrollArea>

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => (
    <div key={i} className="border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-ods-text-primary">
      Row {i + 1} — scrollable content
    </div>
  ))

export const Vertical: Story = {
  render: () => (
    <OverlayScrollArea className="h-72 w-96 rounded-lg border border-ods-border bg-ods-card">
      {rows(40)}
    </OverlayScrollArea>
  ),
}

export const Horizontal: Story = {
  render: () => (
    <OverlayScrollArea className="h-24 w-96 rounded-lg border border-ods-border bg-ods-card">
      <div className="flex w-max gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)]">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="flex h-12 w-28 shrink-0 items-center justify-center rounded-md bg-ods-bg text-ods-text-secondary">
            Chip {i + 1}
          </div>
        ))}
      </div>
    </OverlayScrollArea>
  ),
}

export const Both: Story = {
  render: () => (
    <OverlayScrollArea className="h-72 w-96 rounded-lg border border-ods-border bg-ods-card">
      <div className="w-[800px]">{rows(40)}</div>
    </OverlayScrollArea>
  ),
}
