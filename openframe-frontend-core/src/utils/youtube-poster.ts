// The ONE rule for a YouTube video's poster image, shared by the player (`<Video kind="youtube">`) and every
// server that states a video's thumbnail (structured data, stored posters). Server-safe: no React, no browser APIs.
//
// YouTube serves each thumbnail size at a fixed path, but not every size exists for every video:
//   - `maxresdefault` (1280px) is made only for uploads of 720p or higher, and `sddefault` (640px) is missing too
//     for some older ones (both 404 for `pqeJFYwnkjE`);
//   - the WebP copies (`/vi_webp/`) are missing at EVERY size for some videos, and a `<picture>` whose WebP source
//     404s does not fall back to its `<img>` JPEG;
//   - `hqdefault.jpg` (480x360) exists for every public video.
// Guessing a size that may not exist put a 404 on every crawl of a page (an Ahrefs audit of flamingo.run,
// CU-17tkuw64r38) and could leave the poster blank. So the poster is always `hqdefault.jpg`. It is 4:3 with the
// 16:9 frame letterboxed inside it; drawn with `object-cover` in a 16:9 box the black bars are cropped away exactly.
// A sharper poster is the caller's own `poster`, read from a source that KNOWS which sizes exist.

/** The poster YouTube serves for every public video: `https://i.ytimg.com/vi/<id>/hqdefault.jpg`. */
export function youtubePosterUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
