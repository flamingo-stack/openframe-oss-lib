import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MingoInfoCard } from '../components/chat/mingo-info-card'
import { MonitorIcon } from '../components/icons-v2-generated/devices/monitor-icon'
import { Copy01Icon } from '../components/icons-v2-generated/documents/copy-01-icon'
import { TrashIcon } from '../components/icons-v2-generated/interface/trash-icon'

const AVATAR_SRC = 'https://i.pravatar.cc/80?img=12'

const SAMPLE_MENU = [
  {
    items: [
      {
        id: 'copy',
        label: 'Copy link',
        icon: <Copy01Icon size={16} />,
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] copy link')
        },
      },
      {
        id: 'remove',
        label: 'Remove',
        icon: <TrashIcon size={16} />,
        danger: true,
        onClick: () => {
          // eslint-disable-next-line no-console
          console.log('[story] remove')
        },
      },
    ],
  },
]

const meta: Meta<typeof MingoInfoCard> = {
  title: 'Chat/MingoInfoCard',
  component: MingoInfoCard,
  parameters: {
    // `fullscreen` (not `centered`): `centered` shrinks the wrapper to the
    // content, so the card's `w-full` resolves against a content-sized box and
    // never stretches. A full-width block container lets the card fill 100% and
    // shrink with the canvas — resize the Storybook viewport to see it reflow.
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Figma node `2410:6007`. Horizontal info row: a leading 40px avatar (`imageSrc`) or boxed glyph (`icon`), a title + optional description column, an optional status pill, and a trailing "⋯" overflow menu separated by a vertical divider. Background `ods-card`, border `ods-border`, `rounded-md`. The card is `w-full` — it fills whatever block container it is placed in.',
      },
    },
  },
  argTypes: {
    icon: { control: false },
    menuGroups: { control: false },
    onClick: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full bg-ods-bg p-6">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// The two Figma media variants
// =============================================================================

export const WithImage: Story = {
  args: {
    title: 'Card Title',
    description: 'Card Description',
    imageSrc: AVATAR_SRC,
    imageAlt: 'Acme Corp',
    status: { label: 'Status' },
    menuGroups: SAMPLE_MENU,
  },
}

export const WithIcon: Story = {
  args: {
    title: 'Card Title',
    description: 'Card Description',
    icon: <MonitorIcon size={24} />,
    status: { label: 'Status' },
    menuGroups: SAMPLE_MENU,
  },
}

// =============================================================================
// Optional-element permutations
// =============================================================================

export const WithoutStatus: Story = {
  args: {
    title: 'Card Title',
    description: 'Card Description',
    icon: <MonitorIcon size={24} />,
    menuGroups: SAMPLE_MENU,
  },
}

export const WithoutDescription: Story = {
  args: {
    title: 'Card Title',
    imageSrc: AVATAR_SRC,
    imageAlt: 'Acme Corp',
    status: { label: 'Status' },
    menuGroups: SAMPLE_MENU,
  },
}

export const WithoutMenu: Story = {
  args: {
    title: 'Card Title',
    description: 'Card Description',
    icon: <MonitorIcon size={24} />,
    status: { label: 'Status' },
  },
}

export const Clickable: Story = {
  args: {
    title: 'Card Title',
    description: 'Click anywhere on the row',
    imageSrc: AVATAR_SRC,
    imageAlt: 'Acme Corp',
    status: { label: 'Online' },
    menuGroups: SAMPLE_MENU,
    onClick: () => {
      // eslint-disable-next-line no-console
      console.log('[story] card clicked')
    },
  },
}

export const StatusVariants: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `status.variant` maps to the shared `Tag` palette — `success` (default), `warning`, `error`, `grey`.',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <MingoInfoCard
        title="Production"
        description="All systems operational"
        icon={<MonitorIcon size={24} />}
        status={{ label: 'Online', variant: 'success' }}
        menuGroups={SAMPLE_MENU}
      />
      <MingoInfoCard
        title="Staging"
        description="Elevated latency detected"
        icon={<MonitorIcon size={24} />}
        status={{ label: 'Degraded', variant: 'warning' }}
        menuGroups={SAMPLE_MENU}
      />
      <MingoInfoCard
        title="Legacy host"
        description="Unreachable for 12 minutes"
        icon={<MonitorIcon size={24} />}
        status={{ label: 'Offline', variant: 'error' }}
        menuGroups={SAMPLE_MENU}
      />
      <MingoInfoCard
        title="Archived host"
        description="Decommissioned last quarter"
        icon={<MonitorIcon size={24} />}
        status={{ label: 'Archived', variant: 'grey' }}
        menuGroups={SAMPLE_MENU}
      />
    </div>
  ),
}

export const LongContentTruncates: Story = {
  args: {
    title: 'Some Really Long Card Title That Should Truncate Cleanly Without Wrapping',
    description:
      'An equally long description line that also truncates instead of pushing the status pill and overflow menu off the card',
    imageSrc: AVATAR_SRC,
    imageAlt: 'Acme Corp',
    status: { label: 'Status' },
    menuGroups: SAMPLE_MENU,
  },
}
