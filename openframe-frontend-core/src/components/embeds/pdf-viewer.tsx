"use client"

import React from 'react'
import { Button } from '../ui'
import { Download, Eye } from 'lucide-react'
import { AdobePdfIcon } from '../icons-v2-generated'
import { EmbedIframe } from './embed-iframe'

export interface PdfViewerProps {
  src: string
  fileName?: string
  onPreview?: () => void
  onDownload?: () => void
  height?: string
}

export function PdfViewer({ src, fileName, onPreview, onDownload, height }: PdfViewerProps) {
  const displayName = fileName || 'PDF Document'

  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AdobePdfIcon className="w-16 h-16 text-ods-text-secondary mb-4" />
        <p className="text-ods-text-secondary">PDF file not available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <AdobePdfIcon className="w-5 h-5 shrink-0" />
          <h2 className="text-xl font-semibold text-ods-text-primary truncate">{displayName}</h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="small-legacy"
            href={onPreview ? undefined : src}
            openInNewTab={!onPreview}
            onClick={onPreview}
            leftIcon={<Eye className="w-4 h-4" />}
            className="flex-1 sm:flex-initial"
          >
            Preview
          </Button>
          <Button
            variant="outline"
            size="small-legacy"
            href={onDownload ? undefined : src}
            openInNewTab={!onDownload}
            onClick={onDownload}
            leftIcon={<Download className="w-4 h-4" />}
            className="flex-1 sm:flex-initial"
          >
            Download
          </Button>
        </div>
      </div>
      <EmbedIframe src={src} title={displayName} height={height} />
    </div>
  )
}
