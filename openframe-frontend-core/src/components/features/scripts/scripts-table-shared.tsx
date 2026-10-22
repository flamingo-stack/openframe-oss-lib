'use client';

import type { ReactNode } from 'react';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Button } from '../../ui/button';
import { useLoadingScope } from '../../ui/loading-scope';
import type { ScriptsTableColumnLayout } from './scripts-table-columns';

/** A column's `meta` from its layout: the fields a live table and its skeleton agree on. */
export function scriptsColumnMeta(column: ScriptsTableColumnLayout) {
  return {
    width: column.width,
    hideAt: column.hideAt,
    align: column.align,
    sortable: column.sortable,
    alwaysShowHeader: column.dateFilterable,
  };
}

/** The row menu's cell: outside the row's own link. */
export function RowActionsCell({ children }: { children: ReactNode }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
      {children}
    </div>
  );
}

/**
 * The last cell of a row: its page in a new tab. The row is a link itself, so this opens by script. While the row is
 * read (a loading scope) the button is static chrome: drawn real and inert.
 */
export function OpenInNewTabCell({ href }: { href: string }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(href)}
        disabled={loading}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
      />
    </div>
  );
}
