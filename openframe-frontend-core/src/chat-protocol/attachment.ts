/**
 * A chat attachment: THE one definition, for the hub's upload and view routes, its chat route and tools, and the lib's
 * composer, uploader and bubble. A user row carries it as a standard `file` part whose url is the hub's view proxy
 * (`/api/storage/view/chat-attachments/<storagePath>?t=<viewToken>`), never a signed storage URL; an attachment is
 * `storagePath` + `viewToken` read back from that url (`attachmentOfFilePart`). The hub validates it with its own zod
 * schema over these constants.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { ChatFilePart } from './chat-message';

/** The storage bucket attachments are uploaded to. */
export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments';

/** The folder under the bucket: the upload route's `folder`, so a path is `chat/<uuid>/<filename>`. */
export const CHAT_ATTACHMENTS_FOLDER = 'chat';

/** The hub's view-proxy prefix. A host draws a `file` part through its own `ChatRuntime.endpoints
 *  .attachmentViewUrlPrefix` (`filePartViewUrl`), so a proxied host stays same-origin. */
export const CHAT_ATTACHMENT_VIEW_URL_PREFIX = '/api/storage/view/chat-attachments/';

/** The query parameter of the view url that carries the HMAC view token. */
export const CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM = 't';

export const CHAT_ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_COUNT = 5;

/** How many attachments one message may stage at once; the composer's add button stops there. */
export const CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER = CHAT_ATTACHMENT_MAX_COUNT;

/** The attachment allow-list. Leaves out `image/svg+xml`: an SVG with a script runs it when drawn inline. */
export const CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

/** The images a model reads as an image block (and the bubble draws inline); any other type is a reference to it. */
export const ANTHROPIC_SUPPORTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * An attachment's storage path: `chat/<uuid>/<sanitized-filename>`, what the upload route makes and the only shape the
 * view route serves (its ACL's `pathRegex`).
 */
export const STORAGE_PATH_REGEX = /^chat\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+$/;

/**
 * One attachment. `viewToken` is server-issued (HMAC-signed by the upload route) and rides in the view url's `?t=`.
 * `size` is known while staging and unknown for an attachment read off a `file` part (the standard's part has none).
 */
export interface ChatAttachment {
  storagePath: string;
  viewToken: string;
  contentType: string;
  fileName: string;
  size?: number;
}

/** The view url of an attachment under `viewUrlPrefix` (the hub's own prefix, absolute or not, or a host's). */
export function chatAttachmentViewUrl(viewUrlPrefix: string, storagePath: string, viewToken: string): string {
  return `${viewUrlPrefix}${storagePath}?${CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM}=${encodeURIComponent(viewToken)}`;
}

/** The `file` part of an attachment, its url the view proxy under `viewUrlPrefix`. */
export function filePartOfAttachment(attachment: ChatAttachment, viewUrlPrefix: string): ChatFilePart {
  return {
    type: 'file',
    mediaType: attachment.contentType,
    filename: attachment.fileName,
    url: chatAttachmentViewUrl(viewUrlPrefix, attachment.storagePath, attachment.viewToken),
  };
}

/**
 * The attachment a `file` part names: `chat-attachments/<storage path>` and `t` from its url (relative, absolute, or
 * behind a host's proxy prefix), `mediaType` as `contentType`, `filename` as `fileName`. Null for a part that names
 * none.
 */
export function attachmentOfFilePart(part: Record<string, unknown>): ChatAttachment | null {
  if (typeof part.url !== 'string' || typeof part.mediaType !== 'string') return null;
  let url: URL;
  try {
    url = new URL(part.url, 'http://relative.invalid');
  } catch {
    return null;
  }
  const marker = `/${CHAT_ATTACHMENTS_BUCKET}/`;
  const at = url.pathname.indexOf(marker);
  const viewToken = url.searchParams.get(CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM);
  if (at === -1 || !viewToken) return null;
  const storagePath = url.pathname.slice(at + marker.length);
  if (!STORAGE_PATH_REGEX.test(storagePath)) return null;
  const fileName =
    typeof part.filename === 'string' && part.filename ? part.filename : (storagePath.split('/').pop() ?? storagePath);
  return { storagePath, viewToken, contentType: part.mediaType, fileName };
}

/**
 * A `file` part's address on this host: the tail after `chat-attachments/` re-prefixed with the host's
 * `attachmentViewUrlPrefix`, so a proxied or preview host stays same-origin. A stored url is on the conversation
 * platform's canonical origin; with no prefix, or a url that is no view url, it is used as given.
 */
export function filePartViewUrl(url: string, viewUrlPrefix: string | undefined): string {
  const marker = `${CHAT_ATTACHMENTS_BUCKET}/`;
  const at = url.indexOf(marker);
  return viewUrlPrefix && at !== -1 ? `${viewUrlPrefix}${url.slice(at + marker.length)}` : url;
}
