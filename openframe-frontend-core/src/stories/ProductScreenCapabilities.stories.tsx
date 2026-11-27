import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { CapabilityExplorer, type CapabilityExplorerItem } from '../components/features/capability-explorer';
import { PRODUCT_SCREEN_COMPACT_HEIGHT, ProductScreen } from '../components/product-demo';
import type { ProductScreenKey } from '../components/product-demo/screen-keys';
import { PRODUCT_SCREEN_READABLE_WIDTH } from '../components/ui/product-screen-frame';

/** The table screens of a product page's capabilities section, one job each. */
const JOBS: readonly (CapabilityExplorerItem & { screen: ProductScreenKey })[] = [
  {
    id: 'cloud-tenants',
    screen: 'cloud-tenants',
    title: 'Cloud tenants',
    intro: 'Every customer directory in one list, with what the last access check found.',
  },
  {
    id: 'logs',
    screen: 'logs',
    title: 'Logs',
    intro: 'Search every tool’s events in one place and open the one that matters.',
  },
  {
    id: 'policies',
    screen: 'policies',
    title: 'Policies',
    intro: 'Fleet-wide compliance at a glance, policy by policy.',
  },
  {
    id: 'scripts',
    screen: 'scripts',
    title: 'Scripts',
    intro: 'The script Mingo wrote, and the first night its schedule ran.',
  },
];

const LABELS = { list: 'Jobs', requester: 'You', responder: 'Mingo', previous: 'Previous', next: 'Next' };

/**
 * The product screens as a product page's capabilities section draws them (multi-platform-hub
 * `openframe-capabilities.tsx`, `capability-tabs-section.tsx`), with the same `ProductScreen` props: from the content
 * `lg` step the job list beside one panel, its screen laid out at the readable width (or the screen's own minimum)
 * and scaled to the panel's 420px row; below it a carousel of cards, each with the screen's narrow rendering in a
 * 300px frame. The wide screens draw the product's grid; the cards keep the card rows (a phone's or a tablet's width,
 * where the grid would be cut and a picture cannot scroll).
 */
function CapabilitiesSection({ initialJob }: { initialJob: ProductScreenKey }) {
  const [activeId, setActiveId] = useState<string>(initialJob);
  return (
    <CapabilityExplorer
      items={JOBS}
      labels={LABELS}
      activeId={activeId}
      onActiveChange={setActiveId}
      renderScreen={(item, { compact }) => {
        const job = JOBS.find(candidate => candidate.id === item.id);
        if (!job) return null;
        return (
          <ProductScreen
            screen={job.screen}
            compact={compact}
            appType="openframe"
            designWidth={compact ? undefined : PRODUCT_SCREEN_READABLE_WIDTH}
            height={compact ? PRODUCT_SCREEN_COMPACT_HEIGHT : '100%'}
            className={compact ? undefined : 'h-full'}
          />
        );
      }}
    />
  );
}

const meta = {
  title: 'Product demo/Capabilities section',
  component: CapabilitiesSection,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <div className="bg-ods-bg p-[var(--spacing-system-lf)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapabilitiesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CloudTenants: Story = { args: { initialJob: 'cloud-tenants' } };
export const Logs: Story = { args: { initialJob: 'logs' } };
export const Policies: Story = { args: { initialJob: 'policies' } };
export const Scripts: Story = { args: { initialJob: 'scripts' } };
