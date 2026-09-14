import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { MingoChatHistory } from '../components/chat/mingo-chat-history';
import type { DialogItem } from '../components/chat/types/component.types';
import { FilterList } from '../components/ui/filter-list';

/**
 * Selected-row states across platforms. Each column is wrapped in its own
 * `data-app-type`, so the platform accent tokens (`ods-accent`,
 * `ods-accent-secondary`) resolve per column — the same way the host app's
 * `<body data-app-type>` sets them.
 */
const meta = {
  title: 'ODS/Platform Accent Selection',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PLATFORMS = [
  { appType: 'openframe', label: 'OpenFrame' },
  { appType: 'product-hub', label: 'Product Hub' },
  { appType: 'flamingo', label: 'Flamingo' },
  { appType: 'people-hub', label: 'People Hub' },
] as const;

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const dialogs: DialogItem[] = [
  { id: 'd1', title: 'ClickUp Roadmap', timestamp: new Date(now) },
  { id: 'd2', title: 'Product Roadmap', timestamp: new Date(now - 60 * 1000), unreadMessagesCount: 2 },
  { id: 'd3', title: 'please add a task to me...', timestamp: new Date(now - 3 * DAY) },
  { id: 'd4', title: 'share latest design doc', timestamp: new Date(now - 4 * DAY) },
  { id: 'd5', title: 'share top 5 tenants', timestamp: new Date(now - 5 * DAY) },
];

const filterItems = [
  { id: '1', title: 'Acme Corporation', meta: ['Technology', '100 devices'] },
  { id: '2', title: 'Globex Inc.', meta: ['Finance', '245 devices'] },
  { id: '3', title: 'Initech', meta: ['Consulting', '58 devices'] },
];

function PlatformColumn({ appType, label }: { appType: string; label: string }) {
  const [activeDialogId, setActiveDialogId] = useState('d1');
  const [selected, setSelected] = useState(['2']);
  return (
    <div data-app-type={appType} className="flex w-[320px] flex-col gap-[var(--spacing-system-m)]">
      <div className="text-ods-accent text-h5">{label}</div>
      <div className="flex h-[420px] flex-col rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <MingoChatHistory dialogs={dialogs} activeDialogId={activeDialogId} onSelectDialog={setActiveDialogId} />
      </div>
      <div className="overflow-hidden rounded-md border border-ods-border">
        <FilterList items={filterItems} selectedIds={selected} onChange={setSelected} />
      </div>
    </div>
  );
}

export const AcrossPlatforms: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]">
      {PLATFORMS.map(p => (
        <PlatformColumn key={p.appType} {...p} />
      ))}
    </div>
  ),
};
