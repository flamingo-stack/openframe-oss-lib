import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScrollShadow } from '../components/ui/scroll-fade';

const meta = {
  title: 'UI/ScrollShadow',
  component: ScrollShadow,
  argTypes: {
    axis: {
      control: 'select',
      options: ['vertical', 'horizontal', 'both'],
    },
    color: { control: 'text' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Wrapper that makes its child scrollable and fades the edges where more content exists. ' +
          'The fade color defaults to the page background token and is theme-aware; pass a card/light ' +
          'surface color when the scrollable sits on another surface.',
      },
    },
  },
} satisfies Meta<typeof ScrollShadow>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = ['HOSTNAME', 'PID', 'NAME', 'PATH', 'STATE', 'UID', 'RESIDENT', 'THREADS', 'START TIME'];

const WideTable = () => (
  <div className="w-max min-w-full">
    <div className="flex gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]">
      {COLUMNS.map(col => (
        <div key={col} className="flex h-12 w-[160px] shrink-0 items-center">
          <span className="uppercase text-ods-text-secondary text-h5">{col}</span>
        </div>
      ))}
    </div>
    {[1, 2, 3].map(row => (
      <div
        key={row}
        className="mb-[var(--spacing-system-xsf)] overflow-hidden rounded-md border border-ods-border bg-ods-card"
      >
        <div className="flex h-[78px] items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]">
          {COLUMNS.map(col => (
            <div key={col} className="w-[160px] shrink-0">
              <span className="truncate text-ods-text-primary text-h4">
                {col.toLowerCase()}-{row}
              </span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/** Wide table: right fade on load, left fade appears once scrolled. */
export const HorizontalTable: Story = {
  args: {
    axis: 'horizontal',
    children: <WideTable />,
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <ScrollShadow {...args} />
    </div>
  ),
};

const LongList = () => (
  <div className="flex flex-col gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-mf)]">
    {Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
        <span className="text-ods-text-primary text-h4">Message {i + 1}</span>
      </div>
    ))}
  </div>
);

/** Long list: bottom fade on load, top fade appears once scrolled down. */
export const VerticalList: Story = {
  args: {
    axis: 'vertical',
    children: <LongList />,
    scrollClassName: 'h-[320px]',
  },
  render: args => (
    <div className="max-w-[480px] bg-ods-bg">
      <ScrollShadow {...args} />
    </div>
  ),
};

/**
 * Light-surface usage (e.g. ChatMessageList themes): pass the surface color
 * the content sits on — with theme-aware tokens the same prop value works in
 * both themes; a literal color is shown here to make the story self-contained.
 */
export const LightSurface: Story = {
  args: {
    axis: 'vertical',
    color: '#ffffff',
    children: (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <span className="text-gray-900">Light message {i + 1}</span>
          </div>
        ))}
      </div>
    ),
    scrollClassName: 'h-[320px]',
  },
  render: args => (
    <div className="max-w-[480px] rounded-md bg-white">
      <ScrollShadow {...args} />
    </div>
  ),
};

/** Both axes at once. */
export const BothAxes: Story = {
  args: {
    axis: 'both',
    children: <WideTable />,
    scrollClassName: 'h-[200px]',
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <ScrollShadow {...args} />
    </div>
  ),
};
