'use client';

import { type ReactNode, useMemo } from 'react';
import { CheckIcon, Copy02Icon, Filter02Icon, Refresh02HrIcon, SearchIcon } from '../../icons-v2-generated';
import { PageLayout } from '../../layout/page-layout';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

export interface LogsPageViewProps {
  /** The table (and whatever boundary the host loads it under). */
  children: ReactNode;
  /** The header's Refresh action. */
  onRefresh?: () => void;
  /** Render the page header (title and Refresh). Default true; a section with its own heading passes false. */
  showHeader?: boolean;
  className?: string;
  /** The search field's text. */
  search: string;
  onSearchChange: (value: string) => void;
  /** Hide the search toolbar: there is nothing to search yet. */
  hideSearch?: boolean;
  /** The narrow layout's filter button. */
  onOpenFilters?: () => void;
}

/**
 * The Logs page chrome: the header with its Refresh action and the search
 * toolbar, around the table. The toolbar sits outside the table so the field
 * keeps focus while the host loads another result.
 */
export function LogsPageView({
  children,
  onRefresh,
  showHeader,
  className,
  search,
  onSearchChange,
  hideSearch = false,
  onOpenFilters,
}: LogsPageViewProps) {
  const actions = useMemo(
    () => [
      {
        label: 'Refresh',
        variant: 'outline' as const,
        icon: <Refresh02HrIcon size={24} className="text-ods-text-secondary" />,
        onClick: onRefresh,
      },
    ],
    [onRefresh],
  );

  return (
    <PageLayout title="Logs" actions={actions} showHeader={showHeader} className={className}>
      {!hideSearch && (
        <div className="sticky top-0 z-20 -my-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg py-[var(--spacing-system-l)]">
          <Input
            placeholder="Search for Logs"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="flex-1"
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
          />
          <Button
            variant="outline"
            size="icon"
            className="content-md:hidden"
            onClick={onOpenFilters}
            aria-label="Open filters"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        </div>
      )}

      {children}
    </PageLayout>
  );
}

export interface LogCopyIconButtonProps {
  onClick?: () => void;
  /** The copy just succeeded: the icon is a check. */
  copied?: boolean;
  disabled?: boolean;
}

/** A row's "Copy log details" icon button. The host fetches the log and copies it. */
export function LogCopyIconButton({ onClick, copied = false, disabled = false }: LogCopyIconButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant="outline"
      size="icon"
      leftIcon={copied ? <CheckIcon className="h-5 w-5 text-ods-success" /> : <Copy02Icon className="h-5 w-5" />}
      aria-label="Copy log details"
      className="bg-ods-card"
    />
  );
}
