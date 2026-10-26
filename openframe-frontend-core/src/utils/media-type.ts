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

/** A file's name as a comparison key: no extension, no upload timestamp, letters and digits only, lower case. */
export function mediaNameKey(name: string): string {
  const base = decodeURIComponent(name.split('?')[0].split('/').pop() ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/-\d{10,}$/, '');
  return base.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The SHA-256 of a file's bytes (hex): two picks of the same picture have the same key whatever they are named. */
export async function fileContentKey(file: Blob): Promise<string> {
  const bytes =
    typeof file.arrayBuffer === 'function'
      ? await file.arrayBuffer()
      : // An environment without `Blob.arrayBuffer` (an old WebKit, a test DOM).
        await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
          reader.readAsArrayBuffer(file);
        });
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
