/**
 * PUT a file's bytes to a signed upload URL, with progress and abort. An XHR, because `fetch` reports no upload
 * progress. Used by the hub's Guide uploader (`use-chat-attachments.ts`, Supabase signed URLs) and the OpenFrame one
 * (`use-openframe-attachment-uploads.ts`, the tenant's presigned URLs); each passes the headers its storage asks for.
 */

export interface PutFileOptions {
  /** Headers the signed URL requires (a token, a pinned content type). Sent as given. */
  headers?: Readonly<Record<string, string>>;
  /** The share of the bytes sent, 0 to 1, as the browser reports it. */
  onProgress?: (fraction: number) => void;
  /** Aborting it stops the request: the bytes stop going out and the promise rejects with `Upload cancelled`. */
  signal?: AbortSignal;
  /** Milliseconds before the request gives up. Default 30 minutes. */
  timeoutMs?: number;
}

const DEFAULT_PUT_TIMEOUT_MS = 30 * 60 * 1000;

/** Resolves on a 2xx answer; rejects on any other status, a network error, a timeout or an abort. */
export function putFileWithProgress(url: string, file: Blob, options: PutFileOptions = {}): Promise<void> {
  const { headers, onProgress, signal, timeoutMs = DEFAULT_PUT_TIMEOUT_MS } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Upload cancelled'));
      return;
    }
    const xhr = new XMLHttpRequest();
    let isCompleted = false;

    // One `AbortController` detaches every listener at once, so a finished upload leaks none of them.
    const listeners = new AbortController();
    const cleanup = () => {
      if (isCompleted) return;
      isCompleted = true;
      listeners.abort();
      if (xhr.readyState !== XMLHttpRequest.DONE) xhr.abort();
    };

    const handleProgress = (event: ProgressEvent) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    const handleLoad = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Network error during upload'));
    };
    const handleAbort = () => {
      cleanup();
      reject(new Error('Upload cancelled'));
    };
    const handleTimeout = () => {
      cleanup();
      reject(new Error('Upload timed out'));
    };
    const handleSignalAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener('abort', handleSignalAbort, { once: true, signal: listeners.signal });

    xhr.upload.addEventListener('progress', handleProgress, { signal: listeners.signal });
    xhr.addEventListener('load', handleLoad, { signal: listeners.signal });
    xhr.addEventListener('error', handleError, { signal: listeners.signal });
    xhr.addEventListener('abort', handleAbort, { signal: listeners.signal });
    xhr.addEventListener('timeout', handleTimeout, { signal: listeners.signal });

    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(name, value);
    xhr.timeout = timeoutMs;
    xhr.send(file);
  });
}
