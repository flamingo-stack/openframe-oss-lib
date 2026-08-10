import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { JsonDetailList } from '../components/ui/json-detail-list';

const meta = {
  title: 'UI/JsonDetailList',
  component: JsonDetailList,
} satisfies Meta<typeof JsonDetailList>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_PAYLOAD = {
  rule_id: 'no-hardcoded-colors',
  status: 'failed',
  severity: 'error',
  matched_count: 3,
  is_blocking: true,
  created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  affected_files: ['components/admin/foo.tsx', 'components/admin/bar.tsx'],
  evidence: {
    firstMatch: {
      file: 'components/admin/foo.tsx',
      line: 42,
      snippet: 'className="bg-[#212121] text-white"',
    },
    reviewerNote: 'Hex colors must be replaced with ODS tokens.\nSee the token rules doc.',
  },
};

/**
 * A nested machine payload rendered as readable prose: keys humanised,
 * ISO dates as relative times (hover for the raw timestamp), nested objects
 * indented behind a border, scalar arrays joined inline.
 */
export const Default: Story = {
  args: {
    data: SAMPLE_PAYLOAD,
  },
  render: args => (
    <div className="max-w-xl">
      <JsonDetailList {...args} />
    </div>
  ),
};

/**
 * A JSON string parses transparently — the common case when the payload comes
 * straight out of a text column.
 */
export const FromJsonString: Story = {
  args: {
    data: JSON.stringify(SAMPLE_PAYLOAD),
  },
  render: args => (
    <div className="max-w-xl">
      <JsonDetailList {...args} />
    </div>
  ),
};

/**
 * Unparseable input falls back to a faithful raw render instead of blowing up.
 */
export const RawFallback: Story = {
  args: {
    data: 'plain text note: retried 3 times, gave up',
  },
  render: args => (
    <div className="max-w-xl">
      <JsonDetailList {...args} />
    </div>
  ),
};
