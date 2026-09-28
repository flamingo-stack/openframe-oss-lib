'use client';

import { Loader2 } from 'lucide-react';
import {
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../../utils/cn';
import { ImagePlusIcon } from '../icons-v2-generated/audio-and-visual/image-plus-icon';
import { FileIcon } from '../icons-v2-generated/documents/file-icon';
import { Download02Icon } from '../icons-v2-generated/interface/download-02-icon';
import { TrashIcon } from '../icons-v2-generated/interface/trash-icon';
import { FieldWrapper } from './field-wrapper';

/** A managed file entry for async upload workflows (e.g. presigned URL uploads) */
export interface ManagedFileEntry {
  /** Unique identifier for this file (e.g. temp attachment ID from backend) */
  id: string;
  /** Display file name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Upload status */
  status: 'uploading' | 'uploaded' | 'error';
  /** Error message when status is "error" */
  error?: string;
}

/**
 * The metadata this component needs to validate and list a file. A browser
 * `File` satisfies it structurally, and so can a host's own file handle: a
 * native shell's OS picker hands back a path plus metadata and never a `File`,
 * because the bytes deliberately stay outside the WebView. See `pickFiles`.
 */
export interface FileUploadCandidate {
  name: string;
  size: number;
  type: string;
}

/**
 * A file this component can hand back. Dropping, and the built-in
 * `<input type="file">`, always produce browser `File`s no matter what
 * `pickFiles` returns — so `File` is part of the contract even when `T` is a
 * host's own handle type. Collapses to plain `File` in the default case.
 */
export type FileUploadValue<T extends FileUploadCandidate = File> = T | File;

export interface FileUploadProps<T extends FileUploadCandidate = File> {
  /** Currently selected file(s) — use for simple, synchronous file handling */
  value?: FileUploadValue<T> | FileUploadValue<T>[];
  /** Callback when files change — used with `value` for simple mode */
  onChange: (files: FileUploadValue<T> | FileUploadValue<T>[] | undefined) => void;
  /**
   * Managed file entries for async upload workflows.
   * When provided, the file list renders from these entries instead of `value`.
   * The dropzone still triggers `onChange` with new `File` objects so the consumer can upload them.
   */
  managedFiles?: ManagedFileEntry[];
  /** Callback to remove a managed file by its id. Required when `managedFiles` is provided. */
  onRemoveManagedFile?: (id: string) => void;
  /** When provided, an uploaded managed file shows a download action that calls this with its id. */
  onDownloadManagedFile?: (id: string) => void;
  /** Accepted MIME types (e.g., "image/*", ".pdf,.doc") */
  accept?: string;
  /** Maximum file size in bytes. Default: 10MB */
  maxSize?: number;
  /** Maximum number of files (only used when multiple=true). Default: 10 */
  maxFiles?: number;
  /** Allow multiple file selection. Default: false */
  multiple?: boolean;
  /** Primary label text. Default: "Upload Files" */
  label?: string;
  /** Description text below label. Default: "(Click Here or Drag and Drop)" */
  description?: string;
  /** Field label above the component */
  fieldLabel?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional className */
  className?: string;
  /** Custom icon element */
  icon?: ReactNode;
  /** Max height for the file list area (e.g., 200 or "200px"). When set, the file list scrolls independently. */
  maxListHeight?: number | string;
  /**
   * When true, files dropped anywhere in the window are routed to this component,
   * and the browser's default file-open behavior is suppressed. Use on screens/modals
   * where this is the only drop target. Default: false.
   */
  acceptWindowDrops?: boolean;
  /**
   * Replaces the built-in `<input type="file">` as the source of files. When set,
   * clicking the dropzone calls this instead of opening the input, and whatever it
   * resolves with runs through the same accept/size/count validation before
   * reaching `onChange`. Resolve with an empty array when the user cancels; a
   * rejection surfaces in this component's own error slot.
   *
   * For hosts whose picker a WebView cannot provide — a native shell's OS picker
   * returns file handles rather than `File` objects, which is what widens `T`.
   * Leave unset on the web, where the built-in input is the right answer.
   */
  pickFiles?: () => Promise<T[]>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function matchesAccept(file: FileUploadCandidate, accept: string): boolean {
  if (!accept || accept === '*/*') return true;
  const patterns = accept
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const fileType = (file.type || '').toLowerCase();
  const fileName = file.name.toLowerCase();
  return patterns.some(pattern => {
    if (pattern.startsWith('.')) return fileName.endsWith(pattern);
    if (pattern.endsWith('/*')) return fileType.startsWith(pattern.slice(0, -1));
    return fileType === pattern;
  });
}

function dragHasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'Files') return true;
  }
  return false;
}

export function FileUpload<T extends FileUploadCandidate = File>({
  value,
  onChange,
  managedFiles,
  onRemoveManagedFile,
  onDownloadManagedFile,
  accept = '*/*',
  maxSize = 10 * 1024 * 1024,
  maxFiles = 10,
  multiple = false,
  label = 'Upload Files',
  description = '(Click Here or Drag and Drop)',
  fieldLabel,
  disabled = false,
  error,
  className,
  icon,
  maxListHeight,
  acceptWindowDrops = false,
  pickFiles,
}: FileUploadProps<T>) {
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManaged = managedFiles !== undefined;

  const files = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const currentCount = isManaged ? managedFiles.length : files.length;

  const validateFiles = (incoming: FileUploadValue<T>[]): { accepted: FileUploadValue<T>[]; error: string | null } => {
    if (incoming.length === 0) return { accepted: [], error: null };

    const candidates = multiple ? incoming : incoming.slice(0, 1);

    for (const file of candidates) {
      if (!matchesAccept(file, accept)) {
        return { accepted: [], error: `File "${file.name}" is not an accepted type` };
      }
      if (file.size > maxSize) {
        return {
          accepted: [],
          error: `File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`,
        };
      }
    }

    if (multiple && currentCount + candidates.length > maxFiles) {
      return {
        accepted: [],
        error: `You can attach at most ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'}`,
      };
    }

    return { accepted: candidates, error: null };
  };

  const handleFiles = (incoming: FileList | FileUploadValue<T>[]) => {
    setValidationError(null);
    const fileArray: FileUploadValue<T>[] = Array.isArray(incoming) ? incoming : Array.from(incoming);
    if (fileArray.length === 0) return;

    const { accepted, error: validationErr } = validateFiles(fileArray);
    if (validationErr) {
      setValidationError(validationErr);
      return;
    }
    if (accepted.length === 0) return;

    if (isManaged) {
      onChange(multiple ? accepted : accepted[0]);
    } else if (multiple) {
      onChange([...files, ...accepted]);
    } else {
      onChange(accepted[0]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Refreshed after every commit rather than in the render body: the reader is
  // a drop/paste listener, which cannot fire before a commit.
  const handleFilesRef = useRef(handleFiles);
  useEffect(() => {
    handleFilesRef.current = handleFiles;
  });

  const handleDrag = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: ReactDragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  useEffect(() => {
    if (!acceptWindowDrops || disabled) return undefined;

    let dragCounter = 0;

    const onWindowDragEnter = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) setDragActive(true);
    };
    const onWindowDragOver = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
    };
    const onWindowDragLeave = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setDragActive(false);
    };
    const onWindowDrop = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounter = 0;
      setDragActive(false);
      if (e.dataTransfer?.files?.length) {
        handleFilesRef.current(e.dataTransfer.files);
      }
    };
    const onWindowDragEnd = () => {
      dragCounter = 0;
      setDragActive(false);
    };

    window.addEventListener('dragenter', onWindowDragEnter);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('dragend', onWindowDragEnd);

    return () => {
      window.removeEventListener('dragenter', onWindowDragEnter);
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragend', onWindowDragEnd);
    };
  }, [acceptWindowDrops, disabled]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    if (updated.length === 0) {
      onChange(undefined);
    } else {
      onChange(multiple ? updated : updated[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openDialog = async () => {
    if (disabled) return;
    if (!pickFiles) {
      fileInputRef.current?.click();
      return;
    }
    // A host picker is a real async operation that can fail (a second picker
    // already on screen, an unreadable selection), and this runs from a click
    // handler where a rejection would go unhandled.
    try {
      // Skip the empty (cancelled) case rather than routing it through
      // handleFiles, whose first act is to clear a validation message the user
      // may still be reading.
      const picked = await pickFiles();
      if (picked.length > 0) handleFiles(picked);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Could not open the file picker');
    }
  };

  const displayError = error || validationError || undefined;
  const hasFiles = isManaged ? managedFiles.length > 0 : files.length > 0;
  // Single-file mode hides the dropzone once a file is picked (no more to add);
  // multiple keeps it visible to keep attaching.
  const showDropzone = multiple || !hasFiles;

  return (
    <FieldWrapper label={fieldLabel} error={displayError} className={className}>
      {/* Rendered even when `pickFiles` supersedes it: whether a host has a
          native picker is only knowable on the client, and dropping this node
          from the tree would make the prerendered HTML and the hydrated render
          disagree. It is inert — nothing clicks it once `pickFiles` is set. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* File list (above) + upload dropzone — single bordered list, file-type icon + name/size + actions per row */}
      <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
        {hasFiles && (
          <div
            className={cn(
              'flex flex-col rounded-[6px] border border-ods-border bg-ods-card transition-colors duration-200',
              !maxListHeight && 'overflow-hidden',
              dragActive && 'border-ods-accent',
            )}
            style={
              maxListHeight
                ? {
                    maxHeight: typeof maxListHeight === 'number' ? `${maxListHeight}px` : maxListHeight,
                    overflowY: 'auto',
                  }
                : undefined
            }
          >
            {isManaged
              ? managedFiles.map(entry => (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-center gap-[var(--spacing-system-mf)] border-b border-ods-border px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] last:border-b-0',
                      entry.status === 'error' && 'bg-ods-error/5',
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card">
                      <FileIcon className="size-6 text-ods-text-secondary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ods-text-primary text-h4" title={entry.fileName}>
                        {entry.fileName}
                      </p>
                      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
                        <span className="text-ods-text-secondary text-h6">{formatFileSize(entry.fileSize)}</span>
                        {entry.status === 'uploading' && (
                          <span className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-secondary text-h6">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading...
                          </span>
                        )}
                        {entry.status === 'error' && (
                          <span className="text-ods-error text-h6">{entry.error || 'Upload failed'}</span>
                        )}
                      </div>
                    </div>
                    {onDownloadManagedFile && entry.status === 'uploaded' && (
                      <button
                        type="button"
                        onClick={() => onDownloadManagedFile(entry.id)}
                        className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
                        aria-label={`Download ${entry.fileName}`}
                      >
                        <Download02Icon className="size-6" />
                      </button>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveManagedFile?.(entry.id)}
                        className="shrink-0 text-ods-error transition-opacity hover:opacity-80"
                        aria-label={`Remove ${entry.fileName}`}
                      >
                        <TrashIcon className="size-6" />
                      </button>
                    )}
                  </div>
                ))
              : files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-[var(--spacing-system-mf)] border-b border-ods-border px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] last:border-b-0"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card">
                      <FileIcon className="size-6 text-ods-text-secondary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ods-text-primary text-h4" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-ods-text-secondary text-h6">{formatFileSize(file.size)}</p>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="shrink-0 text-ods-error transition-opacity hover:opacity-80"
                        aria-label={`Remove ${file.name}`}
                      >
                        <TrashIcon className="size-6" />
                      </button>
                    )}
                  </div>
                ))}
          </div>
        )}

        {showDropzone && (
          <button
            type="button"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={openDialog}
            disabled={disabled}
            className={cn(
              'flex w-full cursor-pointer items-center gap-[var(--spacing-system-xsf)] rounded-[6px] border border-dashed p-[var(--spacing-system-sf)] text-left',
              'transition-colors duration-200',
              'border-ods-border bg-ods-card',
              dragActive && 'border-ods-accent bg-ods-accent/5',
              !dragActive && 'hover:border-ods-accent/30',
              disabled && 'cursor-not-allowed opacity-50 hover:border-ods-border',
            )}
          >
            <div className="flex shrink-0 items-center rounded-full border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
              {icon || <ImagePlusIcon className="size-6 text-ods-text-primary" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-ods-text-primary text-h4">{label}</span>
              <span className="text-ods-text-secondary text-h6">{description}</span>
            </div>
          </button>
        )}
      </div>
    </FieldWrapper>
  );
}
