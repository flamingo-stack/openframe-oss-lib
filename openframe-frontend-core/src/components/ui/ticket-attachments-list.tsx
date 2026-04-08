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
}

export function TicketAttachmentsList({ attachments, className }: TicketAttachmentsListProps) {
  if (attachments.length === 0) return null

  return (
    <div className={cn("rounded-[6px] border border-ods-border overflow-hidden", className)}>
      {attachments.map((attachment, index) => (
        <div
          key={attachment.id}
          className={cn(
            "flex items-center gap-4 px-4 py-3 bg-ods-card",
            index < attachments.length - 1 && "border-b border-ods-border",
          )}
        >
          {attachment.thumbnailSrc ? (
            <SquareAvatar
              src={attachment.thumbnailSrc}
              alt={attachment.fileName}
              size="md"
              className="shrink-0"
            />
          ) : (
            <div className="shrink-0 size-10 flex items-center justify-center rounded-[6px] bg-ods-card border border-ods-border">
              <FileIcon className="size-6 text-ods-text-secondary" />
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-h4 text-ods-text-primary truncate">{attachment.fileName}</p>
            <p className="text-h6 text-ods-text-secondary">{attachment.fileSize}</p>
          </div>
          {attachment.onDownload && (
            <button
              type="button"
              onClick={attachment.onDownload}
              className="shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
              aria-label={`Download ${attachment.fileName}`}
            >
              <Download className="size-6" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
