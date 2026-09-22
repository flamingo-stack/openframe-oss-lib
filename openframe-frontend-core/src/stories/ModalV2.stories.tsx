import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  ModalV2,
  ModalV2Content,
  ModalV2Footer,
  ModalV2Header,
  ModalV2Title,
  ModalV2TwoColumn,
} from '../components/ui/modal-v2';
import { Textarea } from '../components/ui/textarea';

type ModalV2StoryMeta = Meta<typeof ModalV2>;

const meta: ModalV2StoryMeta = {
  title: 'UI/ModalV2',
  component: ModalV2,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The current modal. `size` picks the panel width (`default` 28rem / `medium` 42rem / `wide` 1400px); `wide` also FIXES the desktop panel height so it stops jumping as content hydrates in. Use `ModalV2TwoColumn` instead of `ModalV2Content` for two-column editors — below `lg` it is one column with a single outer scroll, from `lg` up each column scrolls independently while header and footer stay pinned.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="min-h-[100dvh] bg-ods-bg p-[var(--spacing-system-xl)]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    size: {
      control: 'radio',
      options: ['default', 'medium', 'wide'],
      description:
        'Panel width. `default` = confirms, `medium` = single-column forms, `wide` = two-column editors (also fixes the desktop height)',
    },
    className: {
      control: 'text',
      description: 'Custom className for the modal panel',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/* ------------------------------------------------------------------ *
 * Story content — deliberately long so the scroll model is reviewable.
 * ------------------------------------------------------------------ */

const VENDOR_FIELDS: { label: string; value: string }[] = [
  { label: 'Vendor name', value: 'Acme Endpoint Security' },
  { label: 'Slug', value: 'acme-endpoint-security' },
  { label: 'Website', value: 'https://acme-endpoint.example' },
  { label: 'Support email', value: 'support@acme-endpoint.example' },
  { label: 'Headquarters', value: 'Austin, TX' },
  { label: 'Founded', value: '2014' },
  { label: 'Employees', value: '240' },
  { label: 'Category', value: 'Endpoint protection' },
  { label: 'Sub-category', value: 'EDR' },
  { label: 'Deployment', value: 'Cloud, on-premise' },
  { label: 'Agent platforms', value: 'Windows, macOS, Linux' },
  { label: 'Compliance', value: 'SOC 2 Type II, ISO 27001' },
  { label: 'Integration partner', value: 'OpenFrame' },
  { label: 'Account manager', value: 'Dana Whitfield' },
  { label: 'Renewal date', value: '2026-11-30' },
  { label: 'Contract owner', value: 'Procurement' },
];

const ACTIVITY_ROWS: { title: string; meta: string; body: string }[] = [
  {
    title: 'Pricing refreshed',
    meta: 'Today · 09:12',
    body: 'Per-device tier moved from $4.20 to $4.60. Annual commitment unchanged.',
  },
  {
    title: 'Feature matrix synced',
    meta: 'Yesterday · 17:40',
    body: 'Ransomware rollback and USB device control marked as generally available.',
  },
  {
    title: 'Case study published',
    meta: '3 days ago',
    body: 'Regional MSP consolidated three agents onto one console after migration.',
  },
  {
    title: 'Security review passed',
    meta: '6 days ago',
    body: 'SOC 2 Type II report re-issued; no exceptions carried forward.',
  },
  {
    title: 'Support SLA updated',
    meta: '2 weeks ago',
    body: 'P1 response tightened to 30 minutes for partners on the managed plan.',
  },
  {
    title: 'Partner tier changed',
    meta: '3 weeks ago',
    body: 'Promoted to Gold. Deal registration discount now applies automatically.',
  },
  {
    title: 'Console redesign shipped',
    meta: '1 month ago',
    body: 'Alert triage moved into a single queue with saved views per technician.',
  },
  {
    title: 'API v3 announced',
    meta: '1 month ago',
    body: 'Webhook payloads gain device tags; v2 stays supported through next year.',
  },
  {
    title: 'Outage postmortem',
    meta: '2 months ago',
    body: 'Ingest backlog cleared in 90 minutes; regional failover added since.',
  },
  {
    title: 'Onboarding docs rewritten',
    meta: '2 months ago',
    body: 'Silent-install flags documented for every supported RMM deployment tool.',
  },
];

function VendorFields({ count = VENDOR_FIELDS.length }: { count?: number }) {
  return (
    <>
      <p className="text-ods-text-secondary text-h5">Vendor profile</p>
      {VENDOR_FIELDS.slice(0, count).map(field => (
        <Input key={field.label} label={field.label} defaultValue={field.value} className="w-full" />
      ))}
      <Textarea
        label="Internal notes"
        rows={4}
        defaultValue="Renewal negotiated alongside the backup vendor. Keep both contracts on the same anniversary so the bundle discount survives."
      />
    </>
  );
}

function ActivityRows({ count = ACTIVITY_ROWS.length }: { count?: number }) {
  return (
    <>
      <p className="text-ods-text-secondary text-h5">Recent activity</p>
      {ACTIVITY_ROWS.slice(0, count).map(row => (
        <div key={row.title} className="rounded-md border border-ods-border p-[var(--spacing-system-mf)]">
          <div className="flex items-baseline justify-between gap-[var(--spacing-system-xsf)]">
            <span className="text-ods-text-primary text-h3">{row.title}</span>
            <span className="text-ods-text-tertiary text-h6">{row.meta}</span>
          </div>
          <p className="mt-[var(--spacing-system-xs)] text-ods-text-secondary text-h6">{row.body}</p>
        </div>
      ))}
    </>
  );
}

/**
 * `size="default"` (28rem) — the confirm-dialog width. Header, one short
 * paragraph, footer.
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    size: 'default',
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen);

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open default modal
        </Button>
        <ModalV2 isOpen={isOpen} onClose={() => setIsOpen(false)} size={args.size}>
          <ModalV2Header>
            <ModalV2Title>Archive vendor</ModalV2Title>
          </ModalV2Header>
          <ModalV2Content>
            <p className="text-ods-text-secondary text-h6">
              Acme Endpoint Security will stop appearing in comparisons and search. Existing references keep working and
              you can restore it at any time.
            </p>
          </ModalV2Content>
          <ModalV2Footer className="justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setIsOpen(false)}>
              Archive
            </Button>
          </ModalV2Footer>
        </ModalV2>
      </>
    );
  },
};

/**
 * `size="medium"` (42rem) — the single-column form width. The body is a plain
 * `ModalV2Content`, so header and footer stay pinned while it scrolls.
 */
export const Medium: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    size: 'medium',
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen);

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open medium modal
        </Button>
        <ModalV2 isOpen={isOpen} onClose={() => setIsOpen(false)} size={args.size}>
          <ModalV2Header>
            <ModalV2Title>Edit vendor</ModalV2Title>
          </ModalV2Header>
          <ModalV2Content className="space-y-[var(--spacing-system-lf)] pr-[var(--spacing-system-sf)]">
            <VendorFields count={8} />
          </ModalV2Content>
          <ModalV2Footer className="justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsOpen(false)}>Save</Button>
          </ModalV2Footer>
        </ModalV2>
      </>
    );
  },
};

/**
 * `size="wide"` (1400px) with a single-column body and deliberately sparse
 * content: on desktop the panel keeps its full `min(90dvh,100%-2rem)` height
 * instead of hugging the content, which is what stops it jumping as an entity
 * hydrates in. Mobile still gets a content-sized bottom sheet.
 */
export const Wide: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    size: 'wide',
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen);

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open wide modal
        </Button>
        <ModalV2 isOpen={isOpen} onClose={() => setIsOpen(false)} size={args.size}>
          <ModalV2Header>
            <ModalV2Title>Vendor loading</ModalV2Title>
          </ModalV2Header>
          <ModalV2Content>
            <p className="text-ods-text-secondary text-h6">
              Two fields of content in a panel that keeps its full height. Compare with the medium story above, which
              shrinks to fit its content.
            </p>
            <div className="mt-[var(--spacing-system-lf)] space-y-[var(--spacing-system-lf)]">
              <Input label="Vendor name" defaultValue="Acme Endpoint Security" className="w-full" />
              <Input label="Slug" defaultValue="acme-endpoint-security" className="w-full" />
            </div>
          </ModalV2Content>
          <ModalV2Footer className="justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsOpen(false)}>Save</Button>
          </ModalV2Footer>
        </ModalV2>
      </>
    );
  },
};

/**
 * The two-column editor: `size="wide"` + `ModalV2TwoColumn`. Both columns
 * overflow, and by different amounts — scroll the left one to the bottom and
 * the right one does not move. Narrow the viewport below `lg` and the two
 * collapse into a single column with one outer scrollbar.
 */
export const WideTwoColumn: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    size: 'wide',
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen);

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open two-column editor
        </Button>
        <ModalV2 isOpen={isOpen} onClose={() => setIsOpen(false)} size={args.size}>
          <ModalV2Header>
            <ModalV2Title>Acme Endpoint Security</ModalV2Title>
            <p className="text-ods-text-secondary text-h6">
              16 fields on the left, 10 activity entries on the right. Each side scrolls on its own at desktop widths.
            </p>
          </ModalV2Header>
          <ModalV2TwoColumn left={<VendorFields />} right={<ActivityRows />} />
          <ModalV2Footer className="justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsOpen(false)}>Save</Button>
          </ModalV2Footer>
        </ModalV2>
      </>
    );
  },
};

/**
 * The regression case for the row sizing. The left column is very long and the
 * right one holds two entries: with an implicit `auto` grid row the row would
 * size to the TALLER column, the columns would get no bounded height to scroll
 * inside, and the outer `overflow-hidden` would clip the bottom of the left
 * column instead. `lg:grid-rows-[minmax(0,1fr)]` is what keeps the left column
 * scrollable and the right one short.
 */
export const TwoColumnUnequalColumns: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    size: 'wide',
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen);

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open lopsided two-column editor
        </Button>
        <ModalV2 isOpen={isOpen} onClose={() => setIsOpen(false)} size={args.size}>
          <ModalV2Header>
            <ModalV2Title>Lopsided columns</ModalV2Title>
            <p className="text-ods-text-secondary text-h6">
              Scroll the left column to its last field — the panel does not grow and nothing is clipped.
            </p>
          </ModalV2Header>
          <ModalV2TwoColumn left={<VendorFields />} right={<ActivityRows count={2} />} />
          <ModalV2Footer className="justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsOpen(false)}>Save</Button>
          </ModalV2Footer>
        </ModalV2>
      </>
    );
  },
};

/**
 * Header and footer live outside the scrolling region, so both stay pinned while
 * the columns move under them. Both are given a divider here to make the seam
 * between the pinned chrome and the scrolling body obvious during review.
 */
export const PinnedHeaderAndFooter: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    size: 'wide',
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen);

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open pinned header/footer editor
        </Button>
        <ModalV2 isOpen={isOpen} onClose={() => setIsOpen(false)} size={args.size}>
          <ModalV2Header className="border-b border-ods-border pb-[var(--spacing-system-mf)]">
            <ModalV2Title>Pinned chrome</ModalV2Title>
            <p className="text-ods-text-secondary text-h6">
              Scroll either column to its end — this header and the footer below stay put, and the close button stays
              reachable the whole time.
            </p>
          </ModalV2Header>
          <ModalV2TwoColumn left={<VendorFields />} right={<ActivityRows count={6} />} />
          <ModalV2Footer className="items-center justify-between border-t border-ods-border pt-[var(--spacing-system-mf)]">
            <span className="text-ods-text-secondary text-h6">Last saved 4 minutes ago</span>
            <div className="flex gap-[var(--spacing-system-mf)]">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsOpen(false)}>Save</Button>
            </div>
          </ModalV2Footer>
        </ModalV2>
      </>
    );
  },
};
