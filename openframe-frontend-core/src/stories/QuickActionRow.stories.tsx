import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { QuickActionChip } from '../components/chat/quick-action-chip';
import { QuickActionRow } from '../components/chat/quick-action-row';

const meta: Meta<typeof QuickActionRow> = {
  title: 'Chat/QuickActionRow',
  component: QuickActionRow,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A chat\'s quick actions above its composer (Figma `chat/quick-actions`, node 4832:14820): one line of 28px outline tags that never wraps and never cuts a name. What does not fit scrolls sideways (touch, trackpad, a mouse wheel over the row, Tab), with a 40px fade at an edge while more continues past it; nothing moves on its own. "All" stays pinned at the right and lists every action: a menu that opens up from the tag from `md`, about ten rows high with the rest scrolling inside it under the same fade, and a sheet from the bottom on a phone. `leading` tags (a mode switch) come first and are not listed under All.',
      },
    },
  },
  argTypes: {
    chips: { control: false },
    leading: { control: false },
    theme: { control: false },
    loading: { control: 'boolean' },
    label: { control: 'text' },
  },
  decorators: [
    Story => (
      // The composer dock's panel: up to 832px, on the page ground. The room above is for the All menu.
      <div className="flex h-[32rem] w-[52rem] max-w-[90vw] flex-col justify-end bg-ods-bg p-[var(--spacing-system-m)]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QuickActionRow>;

const select = (label: string) => () => console.log('select', label);

const ACTIONS: QuickActionChip[] = [
  { id: 'patching', label: 'Patching', icon: { name: 'shield' } },
  { id: 'script', label: 'Write and schedule a script', icon: { name: 'code' } },
  { id: 'reboot', label: 'Reboot or restart a service', icon: { name: 'refresh-01-left' } },
  { id: 'query', label: 'Run a query on devices', icon: { name: 'terminal' } },
  { id: 'logs', label: 'Collect logs from a device', icon: { name: 'file' } },
  { id: 'offline', label: 'Find offline or unhealthy devices', icon: { name: 'search' } },
  { id: 'software', label: 'Install or update software', icon: { name: 'package' } },
  { id: 'maintenance', label: 'Plan a maintenance window', icon: { name: 'calendar' } },
].map(chip => ({ ...chip, onSelect: select(chip.label) }));

/** More actions than fit: the row scrolls, the right edge fades, All lists them all. */
export const Default: Story = {
  args: { chips: ACTIONS, theme: { accent: 'cyan' } },
};

/** Everything fits: no fade, All is still there. */
export const Few: Story = {
  args: { chips: ACTIONS.slice(0, 2), theme: { accent: 'cyan' } },
};

/** Many actions (a hub's full default set): the All menu is about ten rows high and the rest scrolls inside it,
 *  under a fade at the edge the rows continue past. */
export const Many: Story = {
  args: {
    chips: Array.from({ length: 3 }, (_, round) =>
      ACTIONS.map(chip => ({
        ...chip,
        id: `${chip.id}-${round}`,
        label: round ? `${chip.label} ${round + 1}` : chip.label,
      })),
    ).flat(),
    theme: { accent: 'cyan' },
  },
};

/** The icons in the tag's own text colour (OpenFrame), as the "All" glyph is. */
export const NeutralIcons: Story = {
  args: { chips: ACTIONS, theme: { accent: 'currentColor' } },
};

/** One action. */
export const One: Story = {
  args: { chips: ACTIONS.slice(0, 1), theme: { accent: 'cyan' } },
};

/** A tenant's own accent on the icons (the client chat), from the row's theme. */
export const CustomAccent: Story = {
  args: { chips: ACTIONS, theme: { accent: 'pink' } },
};

/** Actions with and without an icon: the tags differ, the All list keeps the names in one column. */
export const MixedIcons: Story = {
  args: {
    chips: ACTIONS.map((chip, i) => (i % 2 === 0 ? chip : { ...chip, icon: undefined })),
    theme: { accent: 'cyan' },
  },
};

/** A long name is never cut: the row scrolls instead. */
export const LongLabels: Story = {
  args: {
    chips: [
      {
        id: 'long',
        label: 'Find every device that has not reported in for a week and open a ticket for each',
        icon: { name: 'search' },
        onSelect: select('long'),
      },
      ...ACTIONS.slice(0, 3),
    ],
    theme: { accent: 'cyan' },
  },
};

/** A mode switch pinned before the actions (Mingo's "Start Guide Chat"): first in the row, not under All. */
export const WithLeadingTag: Story = {
  args: {
    chips: ACTIONS,
    leading: [
      {
        id: 'guide',
        label: 'Start Guide Chat',
        icon: { name: 'compass' },
        variant: 'primary',
        onSelect: select('guide'),
      },
    ],
    theme: { accent: 'cyan' },
  },
};

/** The actions are still read: the tags' loading form at the row's own height, no All. */
export const Loading: Story = {
  args: { chips: [], loading: true },
};

/** A narrow panel (a phone, a split view): the same row, more of it behind the fade. */
export const Narrow: Story = {
  args: { chips: ACTIONS, theme: { accent: 'cyan' } },
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
