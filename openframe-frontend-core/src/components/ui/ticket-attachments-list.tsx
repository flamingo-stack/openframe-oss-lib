'use client';

import { cn } from '../../utils/cn';
import { Download02Icon, FileIcon, TrashIcon } from '../icons-v2-generated';
import { SquareAvatar } from './square-avatar';

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: string;
  thumbnailSrc?: string;
  onDownload?: () => void;
  /** When set, a trash button is rendered before the download button. */
  onDelete?: () => void;
}

export interface TicketAttachmentsListProps {
  attachments: TicketAttachment[];
  className?: string;
  /** `compact` shrinks padding / icon / text / download-button for
   *  in-message rendering (the ticket conversation feed). Default keeps the
   *  roomier full-row layout for any other surface. */
  size?: 'default' | 'compact';
}

export function TicketAttachmentsList({ attachments, className, size = 'default' }: TicketAttachmentsListProps) {
  if (attachments.length === 0) return null;
  const compact = size === 'compact';

  return (
    <div className={cn('overflow-hidden rounded-[6px] border border-ods-border', className)}>
      {attachments.map((attachment, index) => (
        <div
          key={attachment.id}
          className={cn(
            'flex items-center bg-ods-card',
            compact ? 'gap-2 px-2 py-1.5' : 'gap-4 px-4 py-3',
            index < attachments.length - 1 && 'border-b border-ods-border',
          )}
        >
          {attachment.thumbnailSrc ? (
            <SquareAvatar
              src={attachment.thumbnailSrc}
              alt={attachment.fileName}
              size={compact ? 'sm' : 'md'}
              className="shrink-0"
            />
          ) : (
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card',
                compact ? 'size-8' : 'size-10',
              )}
            >
              <FileIcon className={cn('text-ods-text-secondary', compact ? 'size-4' : 'size-6')} />
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              className={cn('truncate text-ods-text-primary', compact ? 'text-h5' : 'text-h4')}
              title={attachment.fileName}
            >
              {attachment.fileName}
            </p>
            {attachment.fileSize && <p className="text-ods-text-secondary text-h6">{attachment.fileSize}</p>}
          </div>
          {attachment.onDelete && (
            <button
              type="button"
              onClick={attachment.onDelete}
              className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-error"
              aria-label={`Delete ${attachment.fileName}`}
            >
              <TrashIcon className={compact ? 'size-4' : 'size-5'} />
            </button>
          )}
          {attachment.onDownload && (
            <button
              type="button"
              onClick={attachment.onDownload}
              className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
              aria-label={`Download ${attachment.fileName}`}
            >
              <Download02Icon className={compact ? 'size-4' : 'size-6'} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
