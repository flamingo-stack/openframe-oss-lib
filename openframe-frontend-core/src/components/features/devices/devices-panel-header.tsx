'use client';

import { BoxArchiveIcon, GridIcon, PlusCircleIcon, TableCellIcon } from '../../icons-v2-generated';
import type { PageActionButton } from '../../ui';

/**
 * The panel header's contents, declared once for both the loaded panel and its
 * `Suspense` fallback.
 *
 * Same reasoning as `scripts-table-columns` on the scripts pages: a loading
 * state that RE-DECLARES the chrome it stands in for drifts from it, silently,
 * and only in the frame nobody screenshots. Reading one declaration is what
 * makes the two identical by construction rather than by review.
 */

/** The table/grid switch. Fed by the `viewMode` URL param, so it needs no data. */
export const DEVICE_VIEW_MODE_ITEMS = [
  { id: 'table', icon: <TableCellIcon className="h-6 w-6" /> },
  { id: 'grid', icon: <GridIcon className="h-6 w-6" /> },
];

export interface DevicePanelActionsOptions {
  /** Shows the "Archive" button linking to the archived-devices page. */
  archiveHref?: string;
  showAddDevice?: boolean;
  noOrganizations?: boolean;
  /** Destination of the "Add Customer" button shown when the tenant has no customers. */
  addCustomerHref?: string;
  isCheckingOrganizations?: boolean;
  /**
   * Accent the "Add Device" button, the panel's pristine-empty state, which is
   * the ONE thing here that needs the list to have answered. Left off while
   * loading: it changes the button's colour, never its size, so the header does
   * not move when the real answer lands.
   */
  accent?: boolean;
  onAddDevice?: () => void;
  /**
   * Loading. Every button the loaded header will have is still rendered, same
   * labels, same icons, same widths, but inert and without its destination, so
   * the header is pixel-identical and nothing is clickable before the panel can
   * honour the click.
   */
  disabled?: boolean;
}

/**
 * The panel's header buttons. Every input is a prop or a URL value, nothing
 * here is derived from the device query, which is what lets the fallback build
 * the same set the loaded panel will.
 */
export function buildDevicePanelActions({
  archiveHref,
  showAddDevice = true,
  noOrganizations = false,
  addCustomerHref,
  isCheckingOrganizations = false,
  accent = false,
  onAddDevice,
  disabled = false,
}: DevicePanelActionsOptions): PageActionButton[] {
  const result: PageActionButton[] = [];

  if (archiveHref) {
    result.push({
      label: 'Archive',
      // A disabled `href` still renders a live link, so the loading copy carries
      // no destination at all rather than a navigable one it cannot honour.
      ...(disabled ? { disabled: true } : { href: archiveHref }),
      icon: <BoxArchiveIcon className="h-5 w-5 text-ods-text-secondary" />,
      variant: 'outline',
    });
  }

  if (!showAddDevice) return result;

  // A device must belong to an organization. With none, "Add Device" is disabled
  // and an "Add Customer" action appears beside it.
  if (noOrganizations) {
    result.push({
      label: 'Add Customer',
      ...(disabled || !addCustomerHref ? { disabled: true } : { href: addCustomerHref }),
      icon: <PlusCircleIcon className="h-5 w-5 text-ods-text-secondary" />,
      variant: 'outline',
    });
  }

  result.push({
    label: 'Add Device',
    onClick: disabled ? undefined : onAddDevice,
    disabled: disabled || noOrganizations || isCheckingOrganizations,
    icon: <PlusCircleIcon className={`h-5 w-5 ${accent ? 'text-ods-text-on-accent' : 'text-ods-text-secondary'}`} />,
    variant: accent ? 'accent' : 'outline',
  });

  return result;
}
