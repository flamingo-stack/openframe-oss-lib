import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Monitor, Smartphone, Tablet, Apple, Globe, Shield } from 'lucide-react';
import { useState } from 'react';
import { TabSelector, type TabSelectorItem } from '../components/ui/tab-selector';

const meta = {
  title: 'UI/TabSelector',
  component: TabSelector,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A tab-style selector with primary (accent) and secondary (soft grey) variants. Supports icons, disabled states, and badges.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
      description: 'Visual variant',
    },
    label: {
      control: 'text',
      description: 'Optional label above the selector',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const basicItems: TabSelectorItem[] = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

const fiveItems: TabSelectorItem[] = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
  { id: 'tab4', label: 'Tab 4' },
  { id: 'tab5', label: 'Tab 5' },
];

const itemsWithIcons: TabSelectorItem[] = [
  { id: 'desktop', label: 'Desktop', icon: <Monitor className="w-5 h-5" /> },
  { id: 'tablet', label: 'Tablet', icon: <Tablet className="w-5 h-5" /> },
  { id: 'mobile', label: 'Mobile', icon: <Smartphone className="w-5 h-5" /> },
];

/**
 * Primary variant with 3 tabs — active tab uses accent background.
 */
export const Primary: Story = {
  args: {
    value: 'tab1',
    items: basicItems,
    variant: 'primary',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Secondary variant — active tab uses soft grey background.
 */
export const Secondary: Story = {
  args: {
    value: 'tab1',
    items: basicItems,
    variant: 'secondary',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Five tabs matching the full Figma design spec.
 */
export const FiveTabs: Story = {
  args: {
    value: 'tab1',
    items: fiveItems,
    variant: 'primary',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Tabs with icons.
 */
export const WithIcons: Story = {
  args: {
    value: 'desktop',
    items: itemsWithIcons,
    variant: 'primary',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * With a label above the selector.
 */
export const WithLabel: Story = {
  args: {
    value: 'desktop',
    items: itemsWithIcons,
    variant: 'primary',
    label: 'Select Device',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Tab with a disabled item.
 */
export const WithDisabled: Story = {
  args: {
    value: 'tab1',
    items: [
      { id: 'tab1', label: 'Tab 1' },
      { id: 'tab2', label: 'Tab 2' },
      { id: 'tab3', label: 'Tab 3', disabled: true },
    ],
    variant: 'primary',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Entire selector disabled via the top-level `disabled` prop.
 */
export const Disabled: Story = {
  args: {
    value: 'tab1',
    items: basicItems,
    variant: 'primary',
    disabled: true,
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Two tabs only.
 */
export const TwoTabs: Story = {
  args: {
    value: 'on',
    items: [
      { id: 'on', label: 'Enabled' },
      { id: 'off', label: 'Disabled' },
    ],
    variant: 'primary',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Real-world example: platform selector with icons.
 */
export const PlatformExample: Story = {
  args: {
    value: 'macos',
    items: [
      { id: 'windows', label: 'Windows', icon: <Monitor className="w-5 h-5" /> },
      { id: 'macos', label: 'macOS', icon: <Apple className="w-5 h-5" /> },
      { id: 'linux', label: 'Linux', icon: <Globe className="w-5 h-5" /> },
    ],
    variant: 'primary',
    label: 'Select Platform',
    onValueChange: () => {},
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TabSelector {...args} value={value} onValueChange={setValue} />;
  },
};

/**
 * Side-by-side comparison of both variants.
 */
export const VariantComparison: Story = {
  args: {
    value: 'tab2',
    items: fiveItems,
    onValueChange: () => {},
  },
  render: function Render() {
    const [primaryValue, setPrimaryValue] = useState('tab2');
    const [secondaryValue, setSecondaryValue] = useState('tab2');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <TabSelector
          value={primaryValue}
          onValueChange={setPrimaryValue}
          items={fiveItems}
          variant="primary"
          label="Primary"
        />
        <TabSelector
          value={secondaryValue}
          onValueChange={setSecondaryValue}
          items={fiveItems}
          variant="secondary"
          label="Secondary"
        />
      </div>
    );
  },
};

/**
 * Real-world example with badges and disabled tabs.
 */
export const WithBadges: Story = {
  args: {
    value: 'basic',
    items: [],
    onValueChange: () => {},
  },
  render: function Render() {
    const [value, setValue] = useState('basic');
    const items: TabSelectorItem[] = [
      { id: 'basic', label: 'Basic', icon: <Shield className="w-5 h-5" /> },
      { id: 'pro', label: 'Pro', icon: <Shield className="w-5 h-5" /> },
      {
        id: 'enterprise',
        label: 'Enterprise',
        icon: <Shield className="w-5 h-5" />,
        disabled: true,
        badge: (
          <span className="text-[10px] bg-[var(--ods-flamingo-cyan-base)] text-ods-text-on-accent px-1.5 py-0.5 rounded font-mono uppercase">
            Soon
          </span>
        ),
      },
    ];
    return <TabSelector value={value} onValueChange={setValue} items={items} variant="primary" label="Plan" />;
  },
};
