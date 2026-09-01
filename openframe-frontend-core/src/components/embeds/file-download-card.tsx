import { FileText, Download } from 'lucide-react';
import { formatFileSize } from '../../utils';
import { Button } from '../ui';

export interface FileDownloadCardProps {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  fileUrl?: string;
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
export function FileDownloadCard({ fileName, mimeType, fileSize, fileUrl }: FileDownloadCardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-ods-border bg-ods-card p-8 text-center">
        <FileText className="mx-auto h-16 w-16 text-ods-text-secondary" />
        <div>
          <h3 className="text-ods-text-primary text-h3">{fileName || 'File'}</h3>
          <div className="mt-2 flex items-center justify-center gap-3 text-ods-text-secondary text-h6">
            {mimeType && <span>{mimeType}</span>}
            {typeof fileSize === 'number' && <span>{formatFileSize(fileSize)}</span>}
          </div>
        </div>
        {fileUrl && (
          <Button variant="accent" href={fileUrl} openInNewTab leftIcon={<Download className="h-4 w-4" />}>
            Download File
          </Button>
        )}
      </div>
    </div>
  );
}
