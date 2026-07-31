import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DashboardInfoCard } from '../components/ui/dashboard-info-card'
import { Tag } from '../components/ui/tag'
import { MonitorIcon } from '../components/icons-v2-generated/devices/monitor-icon'
import { FaceSmile01Icon } from '../components/icons-v2-generated/users/face-smile-01-icon'

const meta = {
  title: 'UI/DashboardInfoCard',
  component: DashboardInfoCard,
  parameters: {
    docs: {
      description: {
        component:
          'A compact info card for dashboards showing a title, value, optional percentage, progress indicator, and tooltip. Supports navigation via href using Next.js Link.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text', description: 'Card title' },
    value: { control: 'text', description: 'Primary value to display' },
    percentage: { control: 'number', description: 'Optional percentage value' },
    showProgress: { control: 'boolean', description: 'Show circular progress indicator' },
    progressVariant: {
      control: { type: 'select' },
      options: ['success', 'warning', 'error', 'info', 'accent'],
      description: 'Color variant of the circular progress',
    },
    percentageDisplay: {
      control: { type: 'inline-radio' },
      options: ['auto', 'plain', 'tag'],
      description: 'How the percentage renders (Tag vs plain text) — independent of the ring color',
    },
    progressSize: {
      control: { type: 'number' },
      description: 'Tablet/desktop ring diameter in px (mobile always shrinks to 24px), or `{ base, md?, lg? }` for full control. Default `{ base: 24, md: 56 }` (Figma spec).',
    },
    href: { control: 'text', description: 'Navigation URL — renders as a Next.js Link with pointer cursor' },
    tooltip: { control: 'text', description: 'Tooltip content for the question-mark icon' },
    valueClassName: { control: 'text', description: 'Override className for the value text' },
    titleTag: { control: false, description: 'Tag rendered in the title row after the title (Figma "status" variant)' },
    icon: { control: false, description: 'Icon or image in a bordered square slot on the left (Figma "icon" variant)' },
  },
} satisfies Meta<typeof DashboardInfoCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default card with a title and numeric value.
 */
export const Default: Story = {
  args: {
    title: 'Total Devices',
    value: 1284,
  },
}

/**
 * Card with a string value.
 */
export const StringValue: Story = {
  args: {
    title: 'Status',
    value: 'Healthy',
  },
}

/**
 * Card displaying a percentage alongside the value.
 */
export const WithPercentage: Story = {
  args: {
    title: 'Uptime',
    value: 342,
    percentage: 97,
  },
}

/**
 * Card with circular progress indicator.
 */
export const WithProgress: Story = {
  args: {
    title: 'Storage Used',
    value: '128 GB',
    percentage: 64,
    showProgress: true,
  },
}

/**
 * Card with a custom progress variant.
 */
export const CustomProgressVariant: Story = {
  args: {
    title: 'CPU Usage',
    value: '78%',
    percentage: 78,
    showProgress: true,
    progressVariant: 'error',
  },
}

/**
 * Card with a tooltip on the value.
 */
export const WithTooltip: Story = {
  args: {
    title: 'Active Users',
    value: 56,
    tooltip: 'Users who logged in within the last 30 days',
  },
}

/**
 * Clickable card with href — renders as a Link with pointer cursor and hover accent.
 */
export const WithHref: Story = {
  args: {
    title: 'Open Tickets',
    value: 23,
    href: '/tickets',
  },
}

/**
 * Card without href — no pointer cursor, no hover accent.
 */
export const NonClickable: Story = {
  args: {
    title: 'Total Revenue',
    value: '$12,400',
  },
}

/**
 * Card with all features enabled.
 */
export const FullyLoaded: Story = {
  args: {
    title: 'Compliance Score',
    value: 92,
    percentage: 92,
    showProgress: true,
    progressVariant: 'success',
    tooltip: 'Based on the latest audit results',
    href: '/compliance',
  },
}

/**
 * Warning variant — the percentage renders as a yellow-tinted Tag next to
 * the value (instead of plain "(NN%)"), matching the Figma overage design.
 */
export const WarningWithTag: Story = {
  args: {
    title: 'Device Usage',
    value: 520,
    percentage: 104,
    showProgress: true,
    progressVariant: 'warning',
    progressOverflow: 'wrap',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `progressVariant` is `warning`, the percentage is displayed as a `Tag variant="warning"` in yellow. With `progressOverflow="wrap"`, the ring shows `104 % 100 = 4%` while the label keeps the real "104%".',
      },
    },
  },
}

/**
 * Error variant — the percentage renders as a red-tinted Tag next to the
 * value, matching the Figma overage design for critical thresholds.
 */
export const ErrorWithTag: Story = {
  args: {
    title: 'Device Usage',
    value: 520,
    percentage: 104,
    showProgress: true,
    progressVariant: 'error',
    progressOverflow: 'wrap',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `progressVariant` is `error`, the percentage is displayed as a `Tag variant="error"` in red. With `progressOverflow="wrap"`, the ring shows `104 % 100 = 4%` in the error color while the label keeps the real "104%".',
      },
    },
  },
}

/**
 * `progressOverflow="wrap"` with the default `success` variant — at 130 the
 * ring shows 30% (wrapped once) while the label reads "130%". Exact laps
 * (200, 300, …) render as a full ring.
 */
export const OverflowWrap: Story = {
  args: {
    title: 'Storage Used',
    value: '1.3 TB',
    percentage: 130,
    showProgress: true,
    progressVariant: 'success',
    progressOverflow: 'wrap',
  },
}

/**
 * Side-by-side comparison of `overflow="clamp"` (default) vs `overflow="wrap"`
 * for the same 130% input.
 */
export const OverflowComparison: Story = {
  args: {
    title: 'Storage',
    value: '1.3 TB',
    percentage: 130,
  },
  decorators: [
    () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '600px' }}>
        <DashboardInfoCard
          title="Clamp (default)"
          value="1.3 TB"
          percentage={130}
          showProgress
          progressVariant="success"
        />
        <DashboardInfoCard
          title="Wrap"
          value="1.3 TB"
          percentage={130}
          showProgress
          progressVariant="success"
          progressOverflow="wrap"
        />
      </div>
    ),
  ],
}

/**
 * `percentageDisplay="plain"` keeps a colored progress ring while rendering the
 * percentage as neutral "(NN%)" text — decoupling ring color from the Tag.
 */
export const PlainPercentageWithColoredRing: Story = {
  args: {
    title: 'Offline Devices',
    value: 20,
    percentage: 10,
    showProgress: true,
    progressVariant: 'error',
    percentageDisplay: 'plain',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Red ring (`progressVariant="error"`) with a plain grey "(10%)" instead of a red Tag, because `percentageDisplay="plain"`.',
      },
    },
  },
}

/**
 * Four counters with
 * distinct ring colors (green / red / amber / grey) and plain "(NN%)" text.
 */
export const DeviceStatusesOverview: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', width: '1100px' }}>
      <DashboardInfoCard
        title="Online Devices"
        value={160}
        percentage={80}
        showProgress
        progressVariant="success"
        percentageDisplay="plain"
      />
      <DashboardInfoCard
        title="Offline Devices"
        value={20}
        percentage={10}
        showProgress
        progressVariant="error"
        percentageDisplay="plain"
      />
      <DashboardInfoCard
        title="Pending Devices"
        value={14}
        percentage={7}
        showProgress
        progressVariant="warning"
        percentageDisplay="plain"
      />
      <DashboardInfoCard
        title="Archived Devices"
        value={6}
        percentage={3}
        showProgress
        progressVariant="info"
        percentageDisplay="plain"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Matches the Figma "Devices Overview" — green/red/amber/grey rings with neutral percentages via `percentageDisplay="plain"`. The responsive ring (24px on mobile, 56px from the `md` breakpoint up) is now the default — no `progressSize` needed.',
      },
    },
  },
}

/**
 * `progressSize` controls the tablet/desktop ring diameter (stroke scales with
 * it); on mobile the ring always shrinks to the 24px Figma spec. Left: 24px.
 * Right: the 56px default. Pass `{ base: n }` to pin one size at every
 * breakpoint.
 */
export const ProgressSizeComparison: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', width: '600px' }}>
      <DashboardInfoCard
        title="Online Devices (24px)"
        value={160}
        percentage={80}
        showProgress
        progressVariant="success"
        percentageDisplay="plain"
        progressSize={24}
      />
      <DashboardInfoCard
        title="Online Devices (56px)"
        value={160}
        percentage={80}
        showProgress
        progressVariant="success"
        percentageDisplay="plain"
        progressSize={56}
      />
    </div>
  ),
}

/**
 * Tag in the title row instead of a plain title — matches the Figma
 * dashboard-card "status" variant (e.g. tickets by status).
 */
export const WithTitleTag: Story = {
  args: {
    value: 75,
    titleTag: <Tag variant="outline" label="AI-Assistance" />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The Figma "status" variant: `titleTag` renders a `Tag` in the title row. Here without a `title`; combine with one for "TITLE + tag" (they sit in a 4px-gap row).',
      },
    },
  },
}

/**
 * Title and tag together in the title row.
 */
export const WithTitleAndTag: Story = {
  args: {
    title: 'Tickets',
    value: 75,
    titleTag: <Tag variant="outline" label="Resolved" />,
  },
}

/**
 * Icon in a bordered square slot on the left — matches the Figma
 * dashboard-card "icon" variant (32px box on mobile, 56px from `md` up).
 */
export const WithIcon: Story = {
  args: {
    title: 'Endpoints',
    value: 4046,
    icon: <MonitorIcon />,
  },
}

/**
 * An `<img>` in the icon slot — the node is stretched to fill the slot's
 * content area, so images work the same as icon components.
 */
export const WithImage: Story = {
  args: {
    title: 'Organization',
    value: 'Flamingo',
    icon: <img src="https://github.com/flamingo-stack.png" alt="Flamingo" className="rounded-[2px] object-cover" />,
  },
}

/**
 * Every prop at once: icon slot, title + tag, sub-value, percentage,
 * colored progress ring with wrap overflow, and navigation href.
 */
export const KitchenSink: Story = {
  args: {
    title: 'Devices',
    titleTag: <Tag variant="outline" label="Live" />,
    icon: <FaceSmile01Icon />,
    value: 4046,
    subValue: '12 sites',
    percentage: 104,
    showProgress: true,
    progressVariant: 'warning',
    percentageDisplay: 'tag',
    progressOverflow: 'wrap',
    progressSize: { base: 24, md: 56 },
    href: '/devices',
  },
  parameters: {
    docs: {
      description: {
        story:
          'All props together: `icon`, `title` + `titleTag`, `value` + `subValue`, `percentage` as a warning `Tag` (`percentageDisplay="tag"`), a wrap-overflow warning ring (`progressOverflow="wrap"`), explicit responsive `progressSize`, and `href`. The `tooltip` prop (question-mark trigger) is shown separately in the WithTooltip story.',
      },
    },
  },
}

/**
 * Multiple cards in a dashboard grid layout.
 */
export const CardGrid: Story = {
  args: {
    title: 'Devices',
    value: 120,
  },
  decorators: [
    () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', width: '900px' }}>
        <DashboardInfoCard title="Total Devices" value={1284} href="/devices" />
        <DashboardInfoCard title="Active" value={1180} percentage={92} />
        <DashboardInfoCard title="Offline" value={104} percentage={8} showProgress progressVariant="error" />
        <DashboardInfoCard title="Tickets" value={23} href="/tickets" />
        <DashboardInfoCard title="Alerts" value={7} tooltip="Unresolved alerts from the last 24h" />
        <DashboardInfoCard title="Uptime" value="99.2%" percentage={99} showProgress />
      </div>
    ),
  ],
}
