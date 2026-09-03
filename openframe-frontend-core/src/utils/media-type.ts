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
