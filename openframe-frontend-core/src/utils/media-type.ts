/**
 * Media type — THE single source of truth for the `media_type` discriminator
 * on media rows (ai_media, program media, vendor media). Zero imports (a leaf),
 * so every consumer reads the same predicate instead of scattering
 * `=== 'video'` literals. `MediaType` (types/marketing.ts) is the row union;
 * these are the two values a post can publish.
 */

export const MEDIA_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

/** The two media types a post can publish. */
export type PublishableMediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];

interface MediaTyped {
  media_type?: string | null;
}

export function isVideoMedia(media: MediaTyped | null | undefined): boolean {
  return media?.media_type === MEDIA_TYPE.VIDEO;
}

export function isImageMedia(media: MediaTyped | null | undefined): boolean {
  return media?.media_type === MEDIA_TYPE.IMAGE;
}

export function isPublishableMediaType(mediaType: string | null | undefined): mediaType is PublishableMediaType {
  return mediaType === MEDIA_TYPE.VIDEO || mediaType === MEDIA_TYPE.IMAGE;
}

/** Split a media list into its videos and images, preserving order. */
export function partitionMediaByType<T extends MediaTyped>(media: readonly T[]): { videos: T[]; images: T[] } {
  return {
    videos: media.filter(m => isVideoMedia(m)),
    images: media.filter(m => isImageMedia(m)),
  };
}

/**
 * What a picked FILE is, for every uploader: its MIME type when the browser
 * states one, else its extension. A phone's HEIC photo often arrives with an
 * empty `type` (the browser has no decoder for it), and a check on the MIME type
 * alone refused it in one uploader while another accepted it.
 */
const IMAGE_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'heic', 'heif', 'bmp', 'tiff'];
const VIDEO_FILE_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];

/** The `accept` of a file input that takes pictures (HEIC named, since `image/*` alone can grey it out). */
export const IMAGE_FILE_ACCEPT = 'image/*,.heic,.heif';
/** The `accept` of a file input that takes pictures and videos. */
export const MEDIA_FILE_ACCEPT = `${IMAGE_FILE_ACCEPT},video/*`;

export function fileMediaType(file: { type?: string; name: string }): PublishableMediaType | null {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return MEDIA_TYPE.IMAGE;
  if (type.startsWith('video/')) return MEDIA_TYPE.VIDEO;
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (IMAGE_FILE_EXTENSIONS.includes(extension)) return MEDIA_TYPE.IMAGE;
  if (VIDEO_FILE_EXTENSIONS.includes(extension)) return MEDIA_TYPE.VIDEO;
  return null;
}
