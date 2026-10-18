import type { Announcement, AnnouncementSurface } from '../types/announcement';

/**
 * Whether an announcement is shown on a surface: it lists that surface, or it
 * lists none (every surface). The bar asks it for its own surface; a server
 * that draws an announcement elsewhere (a hero's news pill) asks it too.
 */
export function isAnnouncementOnSurface(
  announcement: Pick<Announcement, 'surfaces'>,
  surface: AnnouncementSurface,
): boolean {
  const surfaces = announcement.surfaces;
  return !surfaces?.length || surfaces.includes(surface);
}
