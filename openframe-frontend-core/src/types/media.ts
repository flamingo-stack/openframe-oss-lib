export interface Media {
  id: string;
  type: 'image' | 'video';
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