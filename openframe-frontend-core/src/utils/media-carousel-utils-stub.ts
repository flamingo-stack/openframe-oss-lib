export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'youtube';
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
  poster?: string; // For videos
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number; // For videos
}

export function getMediaType(item: MediaItem): 'image' | 'video' | 'youtube' {
  return item.type;
}

export function getMediaSrc(item: MediaItem): string {
  return item.src;
}

export function getMediaPoster(item: MediaItem): string | undefined {
  return item.poster;
}