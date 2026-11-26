/**
 * OpenFrame chat attachments (Mingo and Fae): the limits, the allowed types and the composer layout of each product,
 * and the view models a host maps its files into. Separate from `attachment.ts`, which is the hub's Guide contract
 * (its constants are the hub upload route's and stay as they are).
 *
 * Server-safe: no React, no browser APIs.
 */

/** What kind of file a type is: an image draws a thumbnail; a text type has no magic bytes and is read as text. */
export type OpenFrameAttachmentTypeKind = 'image' | 'document' | 'text' | 'archive' | 'video';

/** One allowed type: its real media type (what the magic bytes say, or the text type) and its extensions. */
export interface OpenFrameAttachmentType {
  mediaType: string;
  extensions: readonly string[];
  kind: OpenFrameAttachmentTypeKind;
}

/** Fae's allowlist: images, PDF and plain-text formats. */
export const OPENFRAME_FAE_ATTACHMENT_TYPES: readonly OpenFrameAttachmentType[] = [
  { mediaType: 'image/png', extensions: ['png'], kind: 'image' },
  { mediaType: 'image/jpeg', extensions: ['jpg', 'jpeg'], kind: 'image' },
  { mediaType: 'image/webp', extensions: ['webp'], kind: 'image' },
  { mediaType: 'image/gif', extensions: ['gif'], kind: 'image' },
  { mediaType: 'application/pdf', extensions: ['pdf'], kind: 'document' },
  { mediaType: 'text/plain', extensions: ['txt', 'log'], kind: 'text' },
  { mediaType: 'text/csv', extensions: ['csv'], kind: 'text' },
  { mediaType: 'application/json', extensions: ['json'], kind: 'text' },
];

/** Mingo's additions to Fae's list: Office documents, sent to the model as extracted text. */
export const OPENFRAME_MINGO_EXTRA_ATTACHMENT_TYPES: readonly OpenFrameAttachmentType[] = [
  {
    mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    kind: 'document',
  },
  {
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    kind: 'document',
  },
];

/** Archives: blocked in v1 (D12), kept behind the profile's `allowArchives` switch. */
export const OPENFRAME_ARCHIVE_ATTACHMENT_TYPES: readonly OpenFrameAttachmentType[] = [
  { mediaType: 'application/zip', extensions: ['zip'], kind: 'archive' },
  { mediaType: 'application/x-7z-compressed', extensions: ['7z'], kind: 'archive' },
  { mediaType: 'application/x-rar-compressed', extensions: ['rar'], kind: 'archive' },
  { mediaType: 'application/vnd.rar', extensions: ['rar'], kind: 'archive' },
];

/** Video: blocked in v1 (D12), kept behind the profile's `allowVideo` switch. */
export const OPENFRAME_VIDEO_ATTACHMENT_TYPES: readonly OpenFrameAttachmentType[] = [
  { mediaType: 'video/mp4', extensions: ['mp4'], kind: 'video' },
  { mediaType: 'video/webm', extensions: ['webm'], kind: 'video' },
  { mediaType: 'video/quicktime', extensions: ['mov'], kind: 'video' },
];

/**
 * The extensions of the image types ("png", "jpg", ...): how a file whose media type is not known yet is told to be an
 * image. Read from the type tables, so a new image type joins it there.
 */
export const OPENFRAME_IMAGE_EXTENSIONS: readonly string[] = [
  ...OPENFRAME_FAE_ATTACHMENT_TYPES,
  ...OPENFRAME_MINGO_EXTRA_ATTACHMENT_TYPES,
  ...OPENFRAME_ARCHIVE_ATTACHMENT_TYPES,
  ...OPENFRAME_VIDEO_ATTACHMENT_TYPES,
]
  .filter(type => type.kind === 'image')
  .flatMap(type => type.extensions);

/** The products that attach files in an OpenFrame chat. */
export type OpenFrameAttachmentProduct = 'mingo' | 'fae';

/** Where the tray of staged files sits: under the input row and wrapping (Mingo), or over it in one scrolling row (Fae). */
export type OpenFrameAttachmentTrayPlacement = 'below' | 'above';

/** How the file picker opens: the `+` menu's "Upload File" (Mingo), or a one-click `+` in the input (Fae). */
export type OpenFrameAttachmentEntryPoint = 'plus-menu' | 'attach-button';

/** Everything a composer needs to know about one product's attachments. */
export interface OpenFrameAttachmentProfile {
  product: OpenFrameAttachmentProduct;
  /** Largest file, in bytes. */
  maxFileBytes: number;
  /** Most files one message carries. */
  maxFilesPerMessage: number;
  /** Most files one chat holds, the ones sent before included. */
  maxFilesPerChat: number;
  /** The allowlist; executables and scripts are never on it. Archives and video join it only through the switches. */
  types: readonly OpenFrameAttachmentType[];
  /** Allow zip / 7z / rar. Off in v1. */
  allowArchives: boolean;
  /** Allow mp4 / webm / mov. Off in v1. */
  allowVideo: boolean;
  trayPlacement: OpenFrameAttachmentTrayPlacement;
  entryPoint: OpenFrameAttachmentEntryPoint;
  /** Show each ready file's token estimate on its tile ("(~2.6k tokens)"). */
  showTokenEstimate: boolean;
}

const MB = 1024 * 1024;

/** Mingo: Fae's types plus DOCX and XLSX, the tray under the input, `+` → "Upload File", token estimates on tiles. */
export const OPENFRAME_MINGO_ATTACHMENT_PROFILE: OpenFrameAttachmentProfile = {
  product: 'mingo',
  maxFileBytes: 20 * MB,
  maxFilesPerMessage: 10,
  maxFilesPerChat: 20,
  types: [...OPENFRAME_FAE_ATTACHMENT_TYPES, ...OPENFRAME_MINGO_EXTRA_ATTACHMENT_TYPES],
  allowArchives: false,
  allowVideo: false,
  trayPlacement: 'below',
  entryPoint: 'plus-menu',
  showTokenEstimate: true,
};

/** Fae: images, PDF and text, the tray over the input, a one-click `+` ("Attach a file"), no token estimates. */
export const OPENFRAME_FAE_ATTACHMENT_PROFILE: OpenFrameAttachmentProfile = {
  product: 'fae',
  maxFileBytes: 20 * MB,
  maxFilesPerMessage: 10,
  maxFilesPerChat: 20,
  types: OPENFRAME_FAE_ATTACHMENT_TYPES,
  allowArchives: false,
  allowVideo: false,
  trayPlacement: 'above',
  entryPoint: 'attach-button',
  showTokenEstimate: false,
};

/** The types a profile accepts: its allowlist plus whatever its switches let in. */
export function openFrameAllowedTypes(profile: OpenFrameAttachmentProfile): readonly OpenFrameAttachmentType[] {
  return [
    ...profile.types,
    ...(profile.allowArchives ? OPENFRAME_ARCHIVE_ATTACHMENT_TYPES : []),
    ...(profile.allowVideo ? OPENFRAME_VIDEO_ATTACHMENT_TYPES : []),
  ];
}

/** The lower-case extension of a file name, without the dot; '' when it has none. */
export function openFrameFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot <= 0 || dot === fileName.length - 1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The file input's `accept`: every allowed extension and media type of the profile. */
export function openFrameAcceptAttribute(profile: OpenFrameAttachmentProfile): string {
  const types = openFrameAllowedTypes(profile);
  const extensions = types.flatMap(type => type.extensions.map(ext => `.${ext}`));
  const mediaTypes = types.map(type => type.mediaType);
  return [...new Set([...extensions, ...mediaTypes])].join(',');
}

/** The largest file of a profile in whole megabytes ("20"). */
export function openFrameMaxFileMegabytes(profile: OpenFrameAttachmentProfile): number {
  return Math.round(profile.maxFileBytes / MB);
}

/**
 * Why a file cannot be sent. The first four are the client's checks; `BLOCKED` (the malware scan) and `UPLOAD_FAILED`
 * come from the upload.
 */
export type OpenFrameAttachmentErrorCode =
  'TOO_LARGE' | 'TYPE_NOT_ALLOWED' | 'CHAT_LIMIT' | 'MESSAGE_LIMIT' | 'BLOCKED' | 'UPLOAD_FAILED';

/** Where a staged file is: on its way up, being scanned, ready to send, or refused (`error` names why). */
export type OpenFrameAttachmentState = 'uploading' | 'scanning' | 'ready' | 'error';

/**
 * One file in the composer's tray: the view model a host (or the uploader) maps its staged file into. The lib draws it
 * and never reads the file itself.
 */
export interface OpenFrameAttachmentItem {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** The real media type when known (the sniffed one); decides image vs file. */
  mediaType?: string;
  state: OpenFrameAttachmentState;
  /** Set when `state` is `error`. */
  error?: OpenFrameAttachmentErrorCode;
  /** Upload progress, 0-100, while `uploading`. */
  progress?: number;
  /** A picture of the file for an image tile (a `blob:` URL of the local file, or the host's thumbnail address). */
  thumbnailUrl?: string;
  /** The model's token estimate of the file, shown when the profile says so. */
  tokenEstimate?: number;
}

/** One file of a sent message, as the host maps its backend part into it. */
export interface OpenFrameMessageAttachment {
  id: string;
  name: string;
  mediaType: string;
  /** Bytes, when known. */
  size?: number;
  /** The image's thumbnail address (a gateway path the host's auth reaches). Drawn by the boxed `Image`. */
  thumbnailUrl?: string;
  /** The full image for the lightbox; the thumbnail when absent. */
  previewUrl?: string;
}

/** Whether a media type is drawn as a picture (a thumbnail and the lightbox) rather than a file tile. */
export function isOpenFrameImageType(mediaType: string | undefined): boolean {
  return mediaType !== undefined && mediaType.startsWith('image/');
}
