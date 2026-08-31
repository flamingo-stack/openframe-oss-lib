'use client';

import { ExternalLink } from 'lucide-react';
import { toGoogleSheetsEmbedUrl, toGoogleSheetsOriginalUrl } from '../../utils/embed-url-converters';
import { GoogleSheetsIcon } from '../icons-v2-generated';
import { Button } from '../ui';
import { EmbedViewerFrame } from './embed-viewer-frame';

export interface GoogleSheetsViewerProps {
  externalUrl: string;
  fileName?: string;
  height?: string;
}

export function GoogleSheetsViewer({ externalUrl, fileName, height }: GoogleSheetsViewerProps) {
  const displayName = fileName || 'Google Sheet';

  // Historical shape: no URL at all → standalone empty state with NO header
  // (the frame's empty body keeps the header — that's the figma behavior).
  if (!externalUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GoogleSheetsIcon className="mb-4 h-16 w-16 text-ods-text-secondary" />
        <p className="text-ods-text-secondary">Google Sheet URL not configured</p>
      </div>
    );
  }

  return (
    <EmbedViewerFrame
      icon={<GoogleSheetsIcon className="h-5 w-5 shrink-0" />}
      title={displayName}
      actions={
        <Button
          variant="outline"
          size="small-legacy"
          href={toGoogleSheetsOriginalUrl(externalUrl)}
          openInNewTab
          leftIcon={<GoogleSheetsIcon className="h-4 w-4" />}
          rightIcon={<ExternalLink className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          Open in Google Sheets
        </Button>
      }
      src={toGoogleSheetsEmbedUrl(externalUrl)}
      height={height}
    />
  );
}
