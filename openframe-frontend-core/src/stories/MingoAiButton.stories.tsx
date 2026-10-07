import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MingoAiButton } from '../components/navigation/mingo-ai-button';

/**
 * The Mingo AI launcher: a 40px rounded button in `SiteHeader`'s right cluster
 * with a 1px travelling accent edge light. The decorator reproduces the 72px
 * bar. The name and the shortcut key cap hide below `lg` (icon-only, see
 * IconOnly); `variant="field"` is the mobile menu's plain row.
 */
const meta = {
  title: 'Navigation/MingoAiButton',
  component: MingoAiButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    source: { control: 'text' },
  },
  decorators: [
    Story => (
      <div className="flex h-[72px] w-[360px] items-center justify-end border-b border-ods-border bg-ods-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MingoAiButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    source: 'flamingo',
  },
};

/** Below `lg` the name is hidden and only the Mingo icon shows. */
export const IconOnly: Story = {
  args: {
    source: 'flamingo',
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
