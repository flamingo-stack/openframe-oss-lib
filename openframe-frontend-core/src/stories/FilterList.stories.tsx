import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { FilterList, FilterListItem } from '../components/ui/filter-list';

const meta = {
  title: 'UI/FilterList',
  component: FilterList,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A selectable list of items with title, optional meta values, and a checkbox. Selected rows switch to a yellow-secondary background and accent-colored meta text.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FilterList>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleItems = [
  { id: '1', title: 'Acme Corporation', meta: ['Technology', '100 devices'] },
  { id: '2', title: 'Globex Inc.', meta: ['Finance', '245 devices'] },
  { id: '3', title: 'Initech', meta: ['Consulting', '58 devices'] },
  { id: '4', title: 'Umbrella Corp', meta: ['Healthcare', '1,024 devices'] },
  { id: '5', title: 'Stark Industries', meta: ['Manufacturing', '3,200 devices'] },
];

/**
 * Default multi-select filter list.
 */
export const Default: Story = {
  args: {
    items: sampleItems,
    selectedIds: ['2'],
    onChange: () => {},
  },
  render: function DefaultList(args) {
    const [selected, setSelected] = useState<string[]>(args.selectedIds);
    return (
      <div className="w-[400px] border border-ods-border rounded-md overflow-hidden">
        <FilterList {...args} selectedIds={selected} onChange={setSelected} />
      </div>
    );
  },
};

/**
 * Single-select mode — only one item can be active at a time.
 */
export const SingleSelect: Story = {
  args: {
    items: sampleItems,
    selectedIds: ['1'],
    onChange: () => {},
    multiple: false,
  },
  render: function SingleList(args) {
    const [selected, setSelected] = useState<string[]>(args.selectedIds);
    return (
      <div className="w-[400px] border border-ods-border rounded-md overflow-hidden">
        <FilterList {...args} selectedIds={selected} onChange={setSelected} />
      </div>
    );
  },
};

/**
 * List without meta values — only titles are shown.
 */
export const NoMeta: Story = {
  args: {
    items: [
      { id: '1', title: 'All Organizations' },
      { id: '2', title: 'Active Only' },
      { id: '3', title: 'Archived' },
    ],
    selectedIds: ['2'],
    onChange: () => {},
  },
  render: function NoMetaList(args) {
    const [selected, setSelected] = useState<string[]>(args.selectedIds);
    return (
      <div className="w-[400px] border border-ods-border rounded-md overflow-hidden">
        <FilterList {...args} selectedIds={selected} onChange={setSelected} />
      </div>
    );
  },
};

/**
 * Items can be disabled individually.
 */
export const WithDisabledItem: Story = {
  args: {
    items: [
      ...sampleItems.slice(0, 2),
      { id: '3', title: 'Initech', meta: ['Consulting', '58 devices'], disabled: true },
      ...sampleItems.slice(3),
    ],
    selectedIds: [],
    onChange: () => {},
  },
  render: function DisabledList(args) {
    const [selected, setSelected] = useState<string[]>(args.selectedIds);
    return (
      <div className="w-[400px] border border-ods-border rounded-md overflow-hidden">
        <FilterList {...args} selectedIds={selected} onChange={setSelected} />
      </div>
    );
  },
};

/**
 * Single `FilterListItem` shown in both default and selected states.
 */
export const ItemStates: StoryObj = {
  render: () => (
    <div className="w-[400px] flex flex-col gap-4">
      <div className="border border-ods-border rounded-md overflow-hidden">
        <FilterListItem
          title="Organization Name"
          meta={['Category', '100 devices']}
          selected={false}
        />
      </div>
      <div className="border border-ods-border rounded-md overflow-hidden">
        <FilterListItem
          title="Organization Name"
          meta={['Category', '100 devices']}
          selected={true}
        />
      </div>
    </div>
  ),
};

/**
 * Long titles truncate with an ellipsis to preserve layout.
 */
export const LongTitles: Story = {
  args: {
    items: [
      {
        id: '1',
        title: 'A Very Long Organization Name That Should Truncate Gracefully',
        meta: ['Enterprise Software Development', '12,500 devices'],
      },
      {
        id: '2',
        title: 'Another Extremely Long Company Name for Testing Purposes',
        meta: ['Telecommunications', '8,320 devices'],
      },
    ],
    selectedIds: ['1'],
    onChange: () => {},
  },
  render: function LongList(args) {
    const [selected, setSelected] = useState<string[]>(args.selectedIds);
    return (
      <div className="w-[400px] border border-ods-border rounded-md overflow-hidden">
        <FilterList {...args} selectedIds={selected} onChange={setSelected} />
      </div>
    );
  },
};
