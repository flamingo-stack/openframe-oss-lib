'use client';

import { type KnowledgeBaseRow, KnowledgeBaseTableBody } from '../../features/knowledge-base';
import { BoxArchiveIcon, FolderEditIcon, PenEditIcon, PlusCircleIcon } from '../../icons-v2-generated';
import { PageLayout } from '../../layout/page-layout';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../../ui/actions-menu';
import type { ColumnDef, Row } from '../../ui/data-table';
import type { PageActionButton } from '../../ui/page-actions';
import { TagSearchInput } from '../../ui/tag-search-input';
import { KNOWLEDGE_FIXTURE } from '../fixtures/knowledge';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

const ICON_CLASS = 'size-[var(--icon-size-icon-size)] text-ods-text-secondary';

/** A picture has nowhere to go: every row leads to the same inert address. */
const getHref = () => '#';

/** The page actions of the product's Knowledge Base root. */
const PAGE_ACTIONS: PageActionButton[] = [
  { label: 'Archive', onClick: noop, icon: <BoxArchiveIcon className={ICON_CLASS} />, variant: 'outline' },
  { label: 'New Folder', onClick: noop, icon: <PlusCircleIcon size={24} className={ICON_CLASS} />, variant: 'outline' },
  {
    label: 'Add Article',
    onClick: noop,
    icon: <PlusCircleIcon size={24} className={ICON_CLASS} />,
    variant: 'outline',
  },
];

const ARTICLE_MENU: ActionsMenuGroup[] = [
  {
    items: [
      { id: 'edit', label: 'Edit', icon: <PenEditIcon className={ICON_CLASS} />, onClick: noop },
      { id: 'move', label: 'Move to folder', icon: <FolderEditIcon className={ICON_CLASS} />, onClick: noop },
      { id: 'archive', label: 'Archive', icon: <BoxArchiveIcon className={ICON_CLASS} />, onClick: noop },
    ],
  },
];

const FOLDER_MENU: ActionsMenuGroup[] = [
  {
    items: [
      { id: 'rename', label: 'Rename', onClick: noop },
      { id: 'move', label: 'Move folder', onClick: noop },
      { id: 'delete', label: 'Delete', onClick: noop },
    ],
  },
];

/** The row menu the product page adds to the table. */
const ACTIONS_COLUMN: ColumnDef<KnowledgeBaseRow> = {
  id: 'actions',
  cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => (
    <div data-no-row-click className="pointer-events-auto flex justify-end">
      <ActionsMenuDropdown groups={row.original.type === 'FOLDER' ? FOLDER_MENU : ARTICLE_MENU} />
    </div>
  ),
  enableSorting: false,
  meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
};

/** The product's Knowledge Base page: title, search and the table. The narrow rendering keeps the name column and the row menu. */
export default function KnowledgeScreen({ compact = false }: ProductScreenViewProps) {
  return (
    <div className="h-full bg-ods-bg">
      <PageLayout
        title="Knowledge Base"
        actionsVariant="menu-primary"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        actions={PAGE_ACTIONS}
      >
        <div className="flex flex-col gap-[var(--spacing-system-l)]">
          <TagSearchInput<string>
            tags={[]}
            searchValue=""
            onSearchChange={noop}
            onTagRemove={noop}
            onClearAll={noop}
            placeholder="Search for Articles"
            addMorePlaceholder="Search for Articles"
          />
          <KnowledgeBaseTableBody
            items={KNOWLEDGE_FIXTURE.items}
            totalCount={KNOWLEDGE_FIXTURE.totalCount}
            getHref={getHref}
            actionsColumn={ACTIONS_COLUMN}
            compact={compact}
          />
        </div>
      </PageLayout>
    </div>
  );
}
