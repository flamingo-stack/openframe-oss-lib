import { BoxArchiveIcon, Link01HorizontalIcon, PackageCheckIcon, PenEditIcon } from '../icons-v2-generated';
import type { ActionsMenuItem } from '../ui/actions-menu';

export interface ChatDialogMenuActions {
  onCopyLink?: () => void;
  onRename?: () => void;
  onCompact?: () => void;
  onArchive?: () => void;
}

export const chatMenuIconClassName = 'h-full w-full text-ods-text-secondary';

/**
 * The per-conversation ⋯ menu — one list for the desktop header, the mobile
 * header, the split header and every history row, so the four can't drift in
 * order, wording or icons. Each action appears only when its handler is set.
 */
export function chatDialogMenuItems({
  onCopyLink,
  onRename,
  onCompact,
  onArchive,
}: ChatDialogMenuActions): ActionsMenuItem[] {
  const items: (ActionsMenuItem | undefined)[] = [
    onCopyLink && {
      id: 'copy-link',
      label: 'Copy Chat Link',
      icon: <Link01HorizontalIcon className={chatMenuIconClassName} />,
      onClick: onCopyLink,
    },
    onRename && {
      id: 'rename',
      label: 'Rename Chat',
      icon: <PenEditIcon className={chatMenuIconClassName} />,
      onClick: onRename,
    },
    onCompact && {
      id: 'compact',
      label: 'Compact Chat Memory',
      icon: <PackageCheckIcon className={chatMenuIconClassName} />,
      onClick: onCompact,
    },
    onArchive && {
      id: 'archive',
      label: 'Archive Chat',
      icon: <BoxArchiveIcon className={chatMenuIconClassName} />,
      onClick: onArchive,
    },
  ];
  return items.filter((item): item is ActionsMenuItem => !!item);
}
