"use client"

import React from 'react'
import { Button } from '../ui'
import { ExternalLink } from 'lucide-react'
import { GoogleSheetsIcon } from '../icons-v2-generated'
import { EmbedViewerFrame } from './embed-viewer-frame'
import { toGoogleSheetsEmbedUrl, toGoogleSheetsOriginalUrl } from '../../utils/embed-url-converters'

export interface GoogleSheetsViewerProps {
  externalUrl: string
  fileName?: string
  height?: string
}

export function GoogleSheetsViewer({ externalUrl, fileName, height }: GoogleSheetsViewerProps) {
  const displayName = fileName || 'Google Sheet'

  // Historical shape: no URL at all → standalone empty state with NO header
  // (the frame's empty body keeps the header — that's the figma behavior).
  if (!externalUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GoogleSheetsIcon className="w-16 h-16 text-ods-text-secondary mb-4" />
        <p className="text-ods-text-secondary">Google Sheet URL not configured</p>
      </div>
    )
  }

  return (
    <EmbedViewerFrame
      icon={<GoogleSheetsIcon className="w-5 h-5 shrink-0" />}
      title={displayName}
      actions={
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
      }
      src={toGoogleSheetsEmbedUrl(externalUrl)}
      height={height}
    />
  )
}
