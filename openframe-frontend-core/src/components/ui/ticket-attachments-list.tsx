"use client"

import * as React from "react"
import { Download, FileIcon } from "lucide-react"
import { cn } from "../../utils/cn"
import { SquareAvatar } from "./square-avatar"

export interface TicketAttachment {
  id: string
  fileName: string
  fileSize: string
  thumbnailSrc?: string
  onDownload?: () => void
}

export interface TicketAttachmentsListProps {
  attachments: TicketAttachment[]
  className?: string
  /** `compact` shrinks padding / icon / text / download-button for
   *  in-message rendering (the ticket conversation feed). Default keeps the
   *  roomier full-row layout for any other surface. */
  size?: 'default' | 'compact'
}

export function TicketAttachmentsList({ attachments, className, size = 'default' }: TicketAttachmentsListProps) {
  if (attachments.length === 0) return null
  const compact = size === 'compact'

  return (
    <div className={cn("rounded-[6px] border border-ods-border overflow-hidden", className)}>
      {attachments.map((attachment, index) => (
        <div
          key={attachment.id}
          className={cn(
            "flex items-center bg-ods-card",
            compact ? "gap-2 px-2 py-1.5" : "gap-4 px-4 py-3",
            index < attachments.length - 1 && "border-b border-ods-border",
          )}
        >
          {attachment.thumbnailSrc ? (
            <SquareAvatar
              src={attachment.thumbnailSrc}
              alt={attachment.fileName}
              size={compact ? "sm" : "md"}
              className="shrink-0"
            />
          ) : (
            <div
              className={cn(
                "shrink-0 flex items-center justify-center rounded-[6px] bg-ods-card border border-ods-border",
                compact ? "size-8" : "size-10",
              )}
            >
              <FileIcon className={cn("text-ods-text-secondary", compact ? "size-4" : "size-6")} />
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p
              className={cn("text-ods-text-primary truncate", compact ? "text-h5" : "text-h4")}
              title={attachment.fileName}
            >
              {attachment.fileName}
            </p>
            {attachment.fileSize && (
              <p className="text-h6 text-ods-text-secondary">{attachment.fileSize}</p>
            )}
          </div>
          {attachment.onDownload && (
            <button
              type="button"
              onClick={attachment.onDownload}
              className="shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
              aria-label={`Download ${attachment.fileName}`}
            >
              <Download className={compact ? "size-4" : "size-6"} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
