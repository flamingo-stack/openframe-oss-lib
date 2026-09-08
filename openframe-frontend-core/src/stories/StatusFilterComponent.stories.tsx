import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { StatusFilterComponent } from '../components/features/status-filter-component';

const meta: Meta<typeof StatusFilterComponent> = {
  title: 'Features/StatusFilterComponent',
  component: StatusFilterComponent,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'THE single-select facet filter row. Renders its own "All" button and drops any option valued `all`, so callers pass real options only. The `label` prop lets one component serve every facet axis (Status, Discipline, Level) — hand-rolling a look-alike row produces markup identical to this one, and React then pairs the copy against this component during hydration and reports a text mismatch (the bug that motivated the prop).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default label. Interactive — pills toggle the selection. */
export const Status: Story = {
  render: function StatusStory() {
    const [status, setStatus] = useState('all');
    return (
      <StatusFilterComponent
        selectedStatus={status}
        onStatusChange={setStatus}
        statusOptions={[
          { value: 'draft', label: 'Draft (1)' },
          { value: 'published', label: 'Published (3)' },
          { value: 'archived', label: 'Archived (1)' },
        ]}
      />
    );
  },
};

/** Relabeled: the same row serving a data-derived Discipline facet, counts in
 *  the labels — how the people-hub How I Work dashboard uses it. */
export const RelabeledFacet: Story = {
  render: function DisciplineStory() {
    const [discipline, setDiscipline] = useState('all');
    return (
      <StatusFilterComponent
        label="Discipline"
        selectedStatus={discipline}
        onStatusChange={setDiscipline}
        statusOptions={[
          { value: 'engineering', label: 'Engineering (4)' },
          { value: 'marketing', label: 'Marketing (2)' },
          { value: 'sales', label: 'Sales (0)' },
        ]}
      />
    );
  },
};

/** Viewer may see every option but select only one (people-hub "Everyone" view
 *  for non-management: pinned to Published, the rest visible but disabled). */
export const DisabledValues: Story = {
  args: {
    label: 'Status',
    selectedStatus: 'published',
    onStatusChange: () => {},
    statusOptions: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'archived', label: 'Archived' },
    ],
    disabledValues: ['all', 'draft', 'archived'],
  },
};

/** View-toggle mode: `showAll={false}` for facets with no all-of-them state —
 *  one option is always selected (Everyone / My Sessions). */
export const ViewToggleNoAll: Story = {
  render: function ViewStory() {
    const [view, setView] = useState('everyone');
    return (
      <StatusFilterComponent
        label="View"
        showAll={false}
        selectedStatus={view}
        onStatusChange={setView}
        statusOptions={[
          { value: 'everyone', label: 'Everyone' },
          { value: 'mine', label: 'My Sessions' },
        ]}
      />
    );
  },
};
