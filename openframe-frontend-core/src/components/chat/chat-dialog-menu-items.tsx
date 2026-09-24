import { BoxArchiveIcon, Link01HorizontalIcon, PackageCheckIcon, PenEditIcon } from '../icons-v2-generated';
import type { ActionsMenuItem } from '../ui/actions-menu';

export interface ChatDialogMenuActions {
  onCopyLink?: () => void;
  onRename?: () => void;
  onCompact?: () => void;
  onArchive?: () => void;
}

const iconClassName = 'h-full w-full text-ods-text-secondary';

/**
 * The per-conversation ⋯ menu — one list for the desktop header, the mobile
 * header, the split header and every history row, so the four can't drift in
 * order, wording or icons. Each action appears only when its handler is set.
 */
export function chatDialogMenuItems({ onCopyLink, onRename, onCompact, onArchive }: ChatDialogMenuActions) {
  return [
    onCopyLink && {
      id: 'copy-link',
      label: 'Copy Chat Link',
      icon: <Link01HorizontalIcon className={iconClassName} />,
      onClick: onCopyLink,
    },
    onRename && {
      id: 'rename',
      label: 'Rename Chat',
      icon: <PenEditIcon className={iconClassName} />,
      onClick: onRename,
    },
    onCompact && {
      id: 'compact',
      label: 'Compact Chat Memory',
      icon: <PackageCheckIcon className={iconClassName} />,
      onClick: onCompact,
    },
    onArchive && {
      id: 'archive',
      label: 'Archive Chat',
      icon: <BoxArchiveIcon className={iconClassName} />,
      onClick: onArchive,
    },
  ].filter(Boolean) as ActionsMenuItem[];
}
