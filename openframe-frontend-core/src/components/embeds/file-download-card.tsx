import { FileText, Download } from 'lucide-react';
import { formatFileSize } from '../../utils';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui';
import { useLoadingScope } from '../ui/loading-scope';

export interface FileDownloadCardProps {
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  fileUrl?: string;
  /** The file is being read: the card draws its loading form. A loading scope does the same. */
  loading?: boolean;
}

/** The card's boxes, shared by the card and its loading form. */
const FILE_CARD_OUTER_CLASS = 'flex flex-col items-center justify-center py-16';
const FILE_CARD_CLASS = 'w-full max-w-md space-y-4 rounded-xl border border-ods-border bg-ods-card p-8 text-center';
const FILE_ICON_CLASS = 'mx-auto h-16 w-16 text-ods-text-secondary';

/**
 * Generic downloadable-file card for the `file` document type. Used by
 * `<DocsHubPage>`'s default `documentTypeRenderers.file`. Embedders can
 * override the default by passing their own `file` renderer.
 *
 * When `fileUrl` is missing, the Download button is omitted (the card still
 * renders the filename + type + size so the user knows what they were
 * about to download).
 */
export function FileDownloadCard({ fileName, mimeType, fileSize, fileUrl, loading = false }: FileDownloadCardProps) {
  // In a loading scope the file is being read: the card draws its own loading form, in its own boxes.
  if (useLoadingScope() || loading) {
    return (
      <div className={FILE_CARD_OUTER_CLASS}>
        <div className={FILE_CARD_CLASS}>
          <FileText className={FILE_ICON_CLASS} />
          <div>
            <TextLineSkeleton type="h3" className="mx-auto w-2/3" />
            <TextLineSkeleton type="h6" className="mx-auto mt-2 w-1/2" />
          </div>
          <InteractiveSkeleton.Button className="mx-auto" />
        </div>
      </div>
    );
  }
  return (
    <div className={FILE_CARD_OUTER_CLASS}>
      <div className={FILE_CARD_CLASS}>
        <FileText className={FILE_ICON_CLASS} />
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
