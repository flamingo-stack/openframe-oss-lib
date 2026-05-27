import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  MingoOnboardingCardSkeleton,
  MingoOnboardingListSkeleton,
} from '../components/chat/mingo-onboarding-card-skeleton'

const meta: Meta<typeof MingoOnboardingListSkeleton> = {
  title: 'Chat/MingoOnboardingCardSkeleton',
  component: MingoOnboardingListSkeleton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Loading-state placeholder for the empty-state onboarding list (Figma node `7363:205938`). Mirrors `MingoOnboardingCard`s outer markup pixel-for-pixel — same `p-[var(--spacing-system-s)]` cell, `bg-ods-card` surface, `border-b` divider, `size-4` icon slot, `text-h6`-tall title/description bars, and `h-7` outline-chip placeholders. The list variant wraps N rows in the same `rounded-md border overflow-hidden` shell the live empty-state uses.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[520px] bg-ods-bg p-4 rounded-md border border-ods-border">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// List (default) — drop-in replacement for the resolved card stack
// =============================================================================

export const Default: Story = {
  args: {
    rows: 6,
  },
}

export const FewRows: Story = {
  args: {
    rows: 3,
  },
}

export const ManyRows: Story = {
  args: {
    rows: 13,
  },
}

// =============================================================================
// Single row — useful when integrating into custom containers
// =============================================================================

export const SingleRowDefault: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card overflow-hidden">
      <MingoOnboardingCardSkeleton />
    </div>
  ),
}

export const SingleRowOneLine: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card overflow-hidden">
      <MingoOnboardingCardSkeleton descriptionLines={1} />
    </div>
  ),
}

export const SingleRowNoChips: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card overflow-hidden">
      <MingoOnboardingCardSkeleton chipWidths={[]} />
    </div>
  ),
}

export const SingleRowCustomWidths: Story = {
  render: () => (
    <div className="rounded-md border border-ods-border bg-ods-card overflow-hidden">
      <MingoOnboardingCardSkeleton
        titleWidth="w-48"
        slashWidth="w-28"
        chipWidths={['w-20', 'w-16', 'w-14', 'w-16']}
      />
    </div>
  ),
}
