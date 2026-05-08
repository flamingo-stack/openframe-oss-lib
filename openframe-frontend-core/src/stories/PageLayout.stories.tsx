import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { PageLayout } from '../components/layout/page-layout'
import { TabSelector } from '../components/ui/tab-selector'
import { Table, type TableColumn } from '../components/ui/table'
import {
  BoxArchiveIcon,
  GridLayoutIcon,
  PenEditIcon,
  PlusCircleIcon,
  TableCellIcon,
} from '../components/icons-v2-generated'

interface Device {
  id: string
  name: string
  status: 'Active' | 'Inactive'
  os: string
  lastOnline: string
}

const sampleDevices: Device[] = [
  { id: '1', name: "John's Device", status: 'Active', os: 'macOS', lastOnline: '26/03/2026 15:42:27' },
  { id: '2', name: "Jane's Device", status: 'Active', os: 'macOS', lastOnline: '26/03/2026 15:40:10' },
  { id: '3', name: 'Reception PC', status: 'Inactive', os: 'Windows', lastOnline: '24/03/2026 09:11:02' },
]

const deviceColumns: TableColumn<Device>[] = [
  { key: 'name', label: 'Device' },
  { key: 'status', label: 'Status' },
  { key: 'os', label: 'OS' },
  { key: 'lastOnline', label: 'Last Online' },
]

const ORG_LOGO_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%23212121"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Azeret Mono, monospace" font-size="22" font-weight="700" fill="%23FFC008">TF</text></svg>`,
  )

const meta = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Standard page layout container with title block, optional back button, optional subtitle, optional thumbnail image, and right-aligned actions.

The \`subtitle\` and \`image\` props are optional — when set, the title block renders the image (square thumbnail with border) on the left and stacks the title + subtitle on the right.
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    actionsVariant: { control: 'select', options: ['icon-buttons', 'primary-buttons', 'menu-primary'] },
  },
} satisfies Meta<typeof PageLayout>

export default meta
type Story = StoryObj<typeof meta>

const sampleContent = (
  <Table data={sampleDevices} columns={deviceColumns} rowKey="id" />
)

/**
 * Title only — baseline header.
 */
export const TitleOnly: Story = {
  args: {
    title: 'Devices',
    children: sampleContent,
  },
}

/**
 * Organization detail page with subtitle, thumbnail image, back button, and header actions —
 * matches the Figma "Organization Details" design.
 *
 * Uses `icon-buttons` so the Archive/Edit actions render as labeled outline buttons on
 * desktop and collapse into a single "…" dropdown trigger next to the title on mobile
 * (matches the mobile Figma).
 */
export const WithSubtitleAndImage: Story = {
  args: {
    title: 'TechFlow Solutions',
    subtitle: 'techflow.com • Software Development',
    image: { src: ORG_LOGO_DATA_URI, alt: 'TechFlow Solutions logo' },
    backButton: { label: 'Back to Organizations', onClick: fn() },
    actionsVariant: 'icon-buttons',
    actions: [
      {
        label: 'Archive Organization',
        onClick: fn(),
        variant: 'outline',
        icon: <BoxArchiveIcon size={24} />,
      },
      {
        label: 'Edit Organization',
        onClick: fn(),
        variant: 'outline',
        icon: <PenEditIcon size={24} />,
      },
    ],
    children: sampleContent,
  },
}

/**
 * Same content as `WithSubtitleAndImage`, viewed in a mobile viewport — actions collapse
 * into a single "…" trigger sitting next to the title.
 */
export const MobileActionsMenu: Story = {
  args: WithSubtitleAndImage.args,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
}

/**
 * Subtitle without image — useful for pages where the title needs a one-line context note.
 */
export const WithSubtitleOnly: Story = {
  args: {
    title: 'Billing',
    subtitle: 'Manage subscription and invoices',
    actionsVariant: 'primary-buttons',
    actions: [
      {
        label: 'Add Payment Method',
        onClick: fn(),
        variant: 'primary',
        icon: <PlusCircleIcon size={24} />,
      },
    ],
    children: sampleContent,
  },
}

/**
 * Image without subtitle — branded entity header without a metadata line.
 */
export const WithImageOnly: Story = {
  args: {
    title: 'TechFlow Solutions',
    image: { src: ORG_LOGO_DATA_URI, alt: 'TechFlow Solutions logo' },
    backButton: { label: 'Back to Organizations', onClick: fn() },
    children: sampleContent,
  },
}

/**
 * Page actions with a desktop-only `selector` (here a `TabSelector` for table/grid view
 * toggle) — matches the Figma "Devices" page. The selector is rendered before the
 * action buttons on desktop. On mobile it is hidden completely and is NOT merged into
 * the "…" dropdown.
 */
export const WithSelector: Story = {
  args: {
    title: 'Devices',
    actionsVariant: 'icon-buttons',
    actions: [
      {
        label: 'Add Device',
        onClick: fn(),
        variant: 'outline',
        icon: <PlusCircleIcon size={24} />,
      },
    ],
    children: sampleContent,
  },
  render: function WithSelectorStory(args) {
    const [view, setView] = useState<'table' | 'grid'>('table')
    return (
      <PageLayout
        {...args}
        selector={
          <TabSelector
            value={view}
            onValueChange={(v) => setView(v as 'table' | 'grid')}
            items={[
              { id: 'table', label: '', icon: <TableCellIcon size={24} /> },
              { id: 'grid', label: '', icon: <GridLayoutIcon size={24} /> },
            ]}
          />
        }
      />
    )
  },
}

/**
 * Same args as `WithSelector` viewed in a mobile viewport — the selector is hidden
 * entirely and only the "…" dropdown for the actions remains.
 */
export const WithSelectorMobile: Story = {
  ...WithSelector,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
}

/**
 * Long title and subtitle truncate with ellipsis when the image is present, so the header
 * stays single-line regardless of content length.
 */
export const LongTitleTruncates: Story = {
  args: {
    title: 'A Very Long Organization Name That Will Not Fit On A Single Line Without Truncation',
    subtitle:
      'verylongdomainname.example.com • An Equally Long Industry Description That Should Truncate',
    image: { src: ORG_LOGO_DATA_URI, alt: '' },
    children: sampleContent,
  },
}
