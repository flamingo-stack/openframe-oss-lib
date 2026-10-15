/**
 * Is this a YouTube URL? A leaf, so the markdown renderer's iframe override and `<Video>` share one check without the
 * renderer importing the video module itself.
 */
export const YT_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Strict YouTube URL detection — parses the URL and checks the hostname. */
export function isYouTubeUrl(url: string): boolean {
  try {
    return YT_HOSTS.has(new URL(url, 'http://placeholder.local').hostname.toLowerCase());
  } catch {
    return false;
  }
}
