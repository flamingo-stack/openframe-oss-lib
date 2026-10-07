import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { KnowledgeBaseTableBody } from '../components/features/knowledge-base';
import { KNOWLEDGE_FIXTURE } from '../components/product-demo/fixtures/knowledge';

const meta: Meta<typeof KnowledgeBaseTableBody> = {
  title: 'Features/KnowledgeBaseTable',
  component: KnowledgeBaseTableBody,
  parameters: { layout: 'fullscreen' },
  args: {
    items: KNOWLEDGE_FIXTURE.items,
    totalCount: KNOWLEDGE_FIXTURE.totalCount,
    getHref: item => `#${item.id}`,
  },
  decorators: [
    Story => (
      <div className="ods-content-area bg-ods-bg p-[var(--spacing-system-l)]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The table as the Knowledge Base page shows it: name, created time, open in a new tab. */
export const Default: Story = {};

/** The narrow rendering: the name column only. */
export const Compact: Story = { args: { compact: true } };

/** The archive listing: the date column reads "Archived" and counts articles. */
export const Archive: Story = {
  args: {
    mode: 'archive',
    items: KNOWLEDGE_FIXTURE.items
      .filter(item => item.type === 'ARTICLE')
      .slice(0, 3)
      .map(item => ({ ...item, status: 'ARCHIVED' })),
    totalCount: 3,
  },
};

/** Loading rows. */
export const Loading: Story = { args: { items: [], isLoading: true, skeletonRows: 5 } };
