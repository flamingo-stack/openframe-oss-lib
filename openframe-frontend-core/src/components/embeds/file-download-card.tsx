import React from 'react'
import { Button } from '../ui'
import { FileText, Download } from 'lucide-react'
import { formatFileSize } from '../../utils'

export interface FileDownloadCardProps {
  fileName?: string
  mimeType?: string
  fileSize?: number
  fileUrl?: string
}

/**
 * Generic downloadable-file card for the `file` document type. Used by
 * `<DocsHubPage>`'s default `documentTypeRenderers.file`. Embedders can
 * override the default by passing their own `file` renderer.
 *
 * When `fileUrl` is missing, the Download button is omitted (the card still
 * renders the filename + type + size so the user knows what they were
 * about to download).
 */
export function FileDownloadCard({
  fileName,
  mimeType,
  fileSize,
  fileUrl,
}: FileDownloadCardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="bg-ods-card border border-ods-border rounded-xl p-8 max-w-md w-full text-center space-y-4">
        <FileText className="w-16 h-16 text-ods-text-secondary mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-ods-text-primary">
            {fileName || 'File'}
          </h3>
          <div className="flex items-center justify-center gap-3 mt-2 text-sm text-ods-text-secondary">
            {mimeType && <span>{mimeType}</span>}
            {typeof fileSize === 'number' && <span>{formatFileSize(fileSize)}</span>}
          </div>
        </div>
        {fileUrl && (
          <Button
            variant="accent"
            href={fileUrl}
            openInNewTab
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download File
          </Button>
        )}
      </div>
    </div>
  )
}
