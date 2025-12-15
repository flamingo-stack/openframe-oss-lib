// Media carousel utilities stub
export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'embed';
  url: string;
  alt?: string;
  caption?: string;
}

export function processMediaItems(items: any[]): MediaItem[] {
  return items.map((item, index) => ({
    id: item.id || index.toString(),
    type: item.type || 'image',
    url: item.url || '',
    alt: item.alt || '',
    caption: item.caption || ''
  }));
}

export function getMediaThumbnail(item: MediaItem): string {
  return item.url;
}