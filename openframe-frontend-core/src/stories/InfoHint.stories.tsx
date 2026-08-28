import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { InfoHint } from '../components/ui/info-hint';

const meta = {
  title: 'UI/InfoHint',
  component: InfoHint,
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof InfoHint>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The "what does this mean?" affordance — hover the ⓘ to reveal the
 * definition. The same text is exposed to assistive tech via
 * `aria-describedby`, so keyboard users are not left out by the hover-only
 * tooltip.
 */
export const Default: Story = {
  args: {
    label: 'Judged rules',
    side: 'top',
    children: 'Judged rules are evaluated by an LLM against the diff; deterministic rules run as code.',
  },
  render: args => (
    <div className="flex min-h-40 items-center justify-center">
      <span className="inline-flex items-center gap-1.5 text-ods-text-primary text-h6">
        Judged rules
        <InfoHint {...args} />
      </span>
    </div>
  ),
};

/**
 * Inline in a row of labels — the `icon-inline` Button variant keeps the
 * target small enough to sit beside a badge without swamping it.
 */
export const InALabelRow: Story = {
  args: {
    children: 'Placeholder',
  },
  render: () => (
    <div className="flex min-h-40 flex-col items-start justify-center gap-[var(--spacing-system-sf)]">
      <span className="inline-flex items-center gap-1.5 text-ods-text-primary text-h6">
        Observe
        <InfoHint label="Observe">Runs the rule and records the outcome without blocking the PR.</InfoHint>
      </span>
      <span className="inline-flex items-center gap-1.5 text-ods-text-primary text-h6">
        Error
        <InfoHint label="Error" side="right">
          A failing rule blocks the merge until the finding is resolved or waived.
        </InfoHint>
      </span>
    </div>
  ),
};
