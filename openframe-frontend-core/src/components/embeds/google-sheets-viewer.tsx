"use client"

import React from 'react'
import { Button } from '../ui'
import { ExternalLink } from 'lucide-react'
import { GoogleSheetsIcon } from '../icons-v2-generated'
import { EmbedIframe } from './embed-iframe'
import { toGoogleSheetsEmbedUrl, toGoogleSheetsOriginalUrl } from '../../utils/embed-url-converters'

export interface GoogleSheetsViewerProps {
  externalUrl: string
  fileName?: string
  height?: string
}

export function GoogleSheetsViewer({ externalUrl, fileName, height }: GoogleSheetsViewerProps) {
  const displayName = fileName || 'Google Sheet'

  if (!externalUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GoogleSheetsIcon className="w-16 h-16 text-ods-text-secondary mb-4" />
        <p className="text-ods-text-secondary">Google Sheet URL not configured</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <GoogleSheetsIcon className="w-5 h-5 shrink-0" />
          <h2 className="text-h3 text-ods-text-primary truncate">{displayName}</h2>
        </div>
        <Button
          variant="outline"
          size="small-legacy"
          href={toGoogleSheetsOriginalUrl(externalUrl)}
          openInNewTab
          leftIcon={<GoogleSheetsIcon className="w-4 h-4" />}
          rightIcon={<ExternalLink className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          Open in Google Sheets
        </Button>
      </div>
      <EmbedIframe
        src={toGoogleSheetsEmbedUrl(externalUrl)}
        title={displayName}
        height={height}
      />
    </div>
  )
}
