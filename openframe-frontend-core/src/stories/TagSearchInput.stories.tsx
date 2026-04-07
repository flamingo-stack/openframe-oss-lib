import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { TagSearchInput, TagSearchOption } from '../components/ui/tag-search-input';

const meta: Meta = {
  title: 'UI/TagSearchInput',
  component: TagSearchInput,
};

export default meta;
type Story = StoryObj;

// ─── Sample data ───

const sampleTags: TagSearchOption[] = [
  { label: 'site:chicago', value: 'site:chicago' },
  { label: 'site:school1', value: 'site:school1' },
  { label: 'env:production', value: 'env:production' },
];

const manyTags: TagSearchOption[] = [
  { label: 'site:chicago', value: 'site:chicago' },
  { label: 'site:school1', value: 'site:school1' },
  { label: 'env:production', value: 'env:production' },
  { label: 'os:windows', value: 'os:windows' },
  { label: 'role:server', value: 'role:server' },
  { label: 'team:devops', value: 'team:devops' },
  { label: 'region:us-east', value: 'region:us-east' },
  { label: 'status:active', value: 'status:active' },
];

// ─── Stories ───

/**
 * Empty state — no tags, just the search input.
 */
export const Empty: Story = {
  render: function Render() {
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 600 }}>
        <TagSearchInput
          tags={[]}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={() => {}}
          placeholder="Search devices..."
        />
      </div>
    );
  },
};

/**
 * A few tags that fit comfortably in one line.
 */
export const WithTags: Story = {
  render: function Render() {
    const [tags, setTags] = useState(sampleTags);
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 800 }}>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
        />
      </div>
    );
  },
};

/**
 * Many tags that overflow — demonstrates the automatic "+N" badge.
 */
export const OverflowWithBadge: Story = {
  render: function Render() {
    const [tags, setTags] = useState(manyTags);
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 600 }}>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
        />
      </div>
    );
  },
};

/**
 * Resize the container to see the "+N" badge update dynamically.
 */
export const Resizable: Story = {
  render: function Render() {
    const [tags, setTags] = useState(manyTags);
    const [search, setSearch] = useState('');
    return (
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          minWidth: 250,
          resize: 'horizontal',
          overflow: 'hidden',
          border: '1px dashed #555',
          padding: 8,
        }}
      >
        <p className="text-ods-text-secondary text-sm mb-2">
          Drag the bottom-right corner to resize
        </p>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
        />
      </div>
    );
  },
};

/**
 * Narrow container — all tags collapse into "+N".
 */
export const NarrowContainer: Story = {
  render: function Render() {
    const [tags, setTags] = useState(sampleTags);
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 300 }}>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
        />
      </div>
    );
  },
};

/**
 * Disabled state.
 */
export const Disabled: Story = {
  render: function Render() {
    return (
      <div style={{ width: 600 }}>
        <TagSearchInput
          tags={sampleTags}
          searchValue=""
          onSearchChange={() => {}}
          onTagRemove={() => {}}
          disabled
        />
      </div>
    );
  },
};

/**
 * With onSubmit — press Enter to trigger a callback.
 */
export const WithSubmit: Story = {
  render: function Render() {
    const [tags, setTags] = useState<TagSearchOption[]>([]);
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 600 }}>
        <p className="text-ods-text-secondary text-sm mb-2">
          Type a value and press Enter to add it as a tag
        </p>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
          onSubmit={(val) => {
            if (val.trim()) {
              setTags((t) => [...t, { label: val.trim(), value: val.trim() }]);
              setSearch('');
            }
          }}
          placeholder="Type and press Enter..."
        />
      </div>
    );
  },
};

/**
 * Fixed limitTags=2 — always shows at most 2 tags, rest in "+N" badge.
 */
export const LimitTags: Story = {
  render: function Render() {
    const [tags, setTags] = useState(manyTags);
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 600 }}>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
          limitTags={2}
        />
      </div>
    );
  },
};

/**
 * Without clear-all button.
 */
export const NoClearAll: Story = {
  render: function Render() {
    const [tags, setTags] = useState(sampleTags);
    const [search, setSearch] = useState('');
    return (
      <div style={{ width: 600 }}>
        <TagSearchInput
          tags={tags}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x.value !== val))}
          showClearAll={false}
        />
      </div>
    );
  },
};

/**
 * All variants displayed together.
 */
export const AllVariants: Story = {
  render: function Render() {
    const [tags1, setTags1] = useState<TagSearchOption[]>([]);
    const [search1, setSearch1] = useState('');
    const [tags2, setTags2] = useState(sampleTags);
    const [search2, setSearch2] = useState('');
    const [tags3, setTags3] = useState(manyTags);
    const [search3, setSearch3] = useState('');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <p className="text-ods-text-secondary text-sm mb-1">Empty</p>
          <TagSearchInput
            tags={tags1}
            searchValue={search1}
            onSearchChange={setSearch1}
            onTagRemove={(val) => setTags1((t) => t.filter((x) => x.value !== val))}
            onClearAll={() => { setTags1([]); setSearch1(''); }}
            placeholder="Search devices..."
          />
        </div>
        <div>
          <p className="text-ods-text-secondary text-sm mb-1">Few tags</p>
          <TagSearchInput
            tags={tags2}
            searchValue={search2}
            onSearchChange={setSearch2}
            onTagRemove={(val) => setTags2((t) => t.filter((x) => x.value !== val))}
            onClearAll={() => { setTags2([]); setSearch2(''); }}
          />
        </div>
        <div>
          <p className="text-ods-text-secondary text-sm mb-1">Many tags (overflow)</p>
          <TagSearchInput
            tags={tags3}
            searchValue={search3}
            onSearchChange={setSearch3}
            onTagRemove={(val) => setTags3((t) => t.filter((x) => x.value !== val))}
            onClearAll={() => { setTags3([]); setSearch3(''); }}
          />
        </div>
        <div>
          <p className="text-ods-text-secondary text-sm mb-1">Disabled</p>
          <TagSearchInput
            tags={sampleTags}
            searchValue=""
            onSearchChange={() => {}}
            onTagRemove={() => {}}
            disabled
          />
        </div>
        <div>
          <p className="text-ods-text-secondary text-sm mb-1">Limit Tags</p>
          <TagSearchInput
            tags={sampleTags}
            searchValue=""
            onSearchChange={() => {}}
            onTagRemove={() => {}}
            limitTags={2}
          />
        </div>

      </div>
    );
  },
};
