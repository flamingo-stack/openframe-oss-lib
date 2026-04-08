import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { FilterModal, type FilterGroup } from '../components/ui/filter-modal';
import { TagKeyValueFilter, type TagKeyConfig } from '../components/ui/tag-key-value-filter';
import { TagSearchInput, type TagSearchOption } from '../components/ui/tag-search-input';

const meta: Meta = {
  title: 'UI/TagKeyValueFilter',
  component: TagKeyValueFilter,
};

export default meta;
type Story = StoryObj;

// ─── Sample data ───

const sampleKeys: TagKeyConfig[] = [
  {
    key: 'site',
    label: 'Site',
    values: [
      { id: 'chicago', label: 'Chicago', count: 42 },
      { id: 'school1', label: 'School 1', count: 18 },
      { id: 'nyc', label: 'New York', count: 31 },
      { id: 'la', label: 'Los Angeles', count: 12 },
    ],
  },
  {
    key: 'env',
    label: 'Environment',
    values: [
      { id: 'production', label: 'Production', count: 67 },
      { id: 'staging', label: 'Staging', count: 23 },
      { id: 'development', label: 'Development', count: 15 },
    ],
  },
  {
    key: 'os',
    label: 'Operating System',
    values: [
      { id: 'windows', label: 'Windows', count: 89 },
      { id: 'macos', label: 'macOS', count: 34 },
      { id: 'linux', label: 'Linux', count: 56 },
    ],
  },
  {
    key: 'role',
    label: 'Role',
    values: [
      { id: 'server', label: 'Server', count: 45 },
      { id: 'workstation', label: 'Workstation', count: 78 },
      { id: 'kiosk', label: 'Kiosk', count: 12 },
    ],
  },
];

const sampleFilterGroups: FilterGroup[] = [
  {
    id: 'status',
    title: 'Status',
    options: [
      { id: 'active', label: 'Active', count: 2975 },
      { id: 'inactive', label: 'Inactive', count: 245 },
      { id: 'maintenance', label: 'Maintenance', count: 105 },
    ],
  },
];

// ─── Stories ───

/**
 * Standalone TagKeyValueFilter — select a key, then pick values.
 */
export const Standalone: Story = {
  render: function Render() {
    const [tags, setTags] = useState<string[]>([]);
    return (
      <div style={{ width: 360 }}>
        <p className="text-ods-text-secondary text-sm mb-3">
          Selected: {tags.length === 0 ? 'none' : tags.join(', ')}
        </p>
        <TagKeyValueFilter
          keys={sampleKeys}
          selectedTags={tags}
          onTagsChange={setTags}
        />
      </div>
    );
  },
};

/**
 * With pre-selected tags.
 */
export const WithPreselected: Story = {
  render: function Render() {
    const [tags, setTags] = useState<string[]>([
      'site:chicago',
      'site:school1',
      'env:production',
    ]);
    return (
      <div style={{ width: 360 }}>
        <p className="text-ods-text-secondary text-sm mb-3">
          Selected: {tags.join(', ')}
        </p>
        <TagKeyValueFilter
          keys={sampleKeys}
          selectedTags={tags}
          onTagsChange={setTags}
        />
      </div>
    );
  },
};

/**
 * Combined with TagSearchInput — full workflow.
 */
export const WithTagSearchInput: Story = {
  render: function Render() {
    const [tags, setTags] = useState<string[]>(['site:chicago', 'env:production']);
    const [search, setSearch] = useState('');

    const tagOptions: TagSearchOption[] = tags.map((t) => ({ label: t, value: t }));

    return (
      <div style={{ width: 600 }} className="flex flex-col gap-4">
        <TagSearchInput
          tags={tagOptions}
          searchValue={search}
          onSearchChange={setSearch}
          onTagRemove={(val) => setTags((t) => t.filter((x) => x !== val))}
          onClearAll={() => { setTags([]); setSearch(''); }}
          placeholder="Search devices..."
        />
        <TagKeyValueFilter
          keys={sampleKeys}
          selectedTags={tags}
          onTagsChange={setTags}
        />
      </div>
    );
  },
};

/**
 * Inside FilterModal — combined with regular filter groups.
 */
export const InsideFilterModal: Story = {
  render: function Render() {
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [tags, setTags] = useState<string[]>([]);

    return (
      <div>
        <div className="flex gap-3 items-center">
          <Button onClick={() => setIsOpen(true)}>Open Filter</Button>
          <span className="text-ods-text-secondary text-sm">
            Tags: {tags.length === 0 ? 'none' : tags.join(', ')}
          </span>
        </div>
        <FilterModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          filterGroups={sampleFilterGroups}
          currentFilters={filters}
          onFilterChange={setFilters}
          tagFilterKeys={sampleKeys}
          selectedTags={tags}
          onTagsChange={setTags}
          tagFilterTitle="Device Tags"
        />
      </div>
    );
  },
};

/**
 * FilterModal with tag filters only (no regular filter groups).
 */
export const FilterModalTagsOnly: Story = {
  render: function Render() {
    const [isOpen, setIsOpen] = useState(false);
    const [tags, setTags] = useState<string[]>([]);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Tag Filter</Button>
        <FilterModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Filter by Tags"
          filterGroups={[]}
          onFilterChange={() => {}}
          tagFilterKeys={sampleKeys}
          selectedTags={tags}
          onTagsChange={setTags}
        />
      </div>
    );
  },
};
