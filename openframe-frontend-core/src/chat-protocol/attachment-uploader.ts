/**
 * The OpenFrame (Mingo, Fae) chat-file uploader: what a host gives the lib so that the lib can upload a file and follow
 * it until the server says it is ready. The host talks to its own backend over its own client (web `apiClient`, Fae
 * `chatFetch`); the lib PUTs the bytes and runs the states. The hub's Guide uploader (`use-chat-attachments.ts`) is
 * separate and keeps its own contract.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { OpenFrameAttachmentErrorCode } from './attachment-profiles';

/** The file a host asks an upload URL for: its name, its real (sniffed) media type and its size in bytes. */
export interface OpenFrameAttachmentUploadRequest {
  name: string;
  mediaType: string;
  size: number;
}

/** Where to PUT the bytes, and the id the server knows the file by (sent with the message). */
export interface OpenFrameAttachmentUploadTarget {
  attachmentId: string;
  /** The presigned URL. The lib PUTs to it with no credential of its own: no cookie, no bearer, no client header. */
  uploadUrl: string;
  /** Headers the presigned URL was signed with (a pinned content type, a size cap). Sent exactly as given. */
  uploadHeaders?: Readonly<Record<string, string>>;
}

/** Where the server is with a file after its bytes went up. */
export type OpenFrameAttachmentServerState = 'uploading' | 'scanning' | 'ready' | 'blocked' | 'failed';

/** The server's word on one file. */
export interface OpenFrameAttachmentServerStatus {
  attachmentId: string;
  state: OpenFrameAttachmentServerState;
  /** Why a `failed` file failed (the host maps its backend's code). `blocked` is always `BLOCKED`. */
  error?: OpenFrameAttachmentErrorCode;
  /** The tokens the file costs the dialog's model, once known. */
  tokenEstimate?: number;
  /** The server's thumbnail of an image, when it has one. The tile keeps the local picture otherwise. */
  thumbnailUrl?: string;
}

/**
 * What a host implements. Both calls get an `AbortSignal`: the user removed the file, or the composer went away.
 * A refusal the host can name (the server's code) is thrown as `OpenFrameAttachmentUploadError`; anything else thrown
 * shows the file as `UPLOAD_FAILED`.
 */
export interface OpenFrameAttachmentUploader {
  /** Ask the server for the file's upload URL. */
  createUpload: (
    request: OpenFrameAttachmentUploadRequest,
    signal: AbortSignal,
  ) => Promise<OpenFrameAttachmentUploadTarget>;
  /** Read the status of files whose bytes are up. One call for every file still waiting; a missing id keeps waiting. */
  getStatuses: (attachmentIds: readonly string[], signal: AbortSignal) => Promise<OpenFrameAttachmentServerStatus[]>;
}

/** A refusal with a code the tile can show ("File too large", "Blocked by scan", ...). */
export class OpenFrameAttachmentUploadError extends Error {
  readonly code: OpenFrameAttachmentErrorCode;

  constructor(code: OpenFrameAttachmentErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'OpenFrameAttachmentUploadError';
    this.code = code;
  }
}
