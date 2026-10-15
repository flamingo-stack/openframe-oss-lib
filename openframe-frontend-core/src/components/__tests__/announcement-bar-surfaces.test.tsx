import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Announcement, AnnouncementSurface } from '../../types/announcement';
import { AnnouncementBar } from '../announcement-bar';

const announcement = (surfaces: AnnouncementSurface[] | null): Announcement => ({
  id: 'a1',
  title: 'New release',
  description: 'Read about it',
  background_color: '#000000',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  surfaces,
});

const bar = () => screen.queryByRole('region', { name: 'Announcement' });

describe('AnnouncementBar surfaces', () => {
  it('stays collapsed on a surface the announcement does not list', () => {
    render(<AnnouncementBar initialAnnouncement={announcement(['web', 'desktop'])} surface="mobile" />);
    expect(bar()).not.toBeInTheDocument();
  });

  it('shows on a surface the announcement lists', () => {
    render(<AnnouncementBar initialAnnouncement={announcement(['web', 'desktop'])} surface="desktop" />);
    expect(bar()).toBeInTheDocument();
  });

  it('treats a host that names no surface as the web: a phone-only announcement stays collapsed', () => {
    render(<AnnouncementBar initialAnnouncement={announcement(['mobile'])} />);
    expect(bar()).not.toBeInTheDocument();
  });

  it.each([null, []])('shows on every surface when the announcement lists none (%j)', surfaces => {
    render(<AnnouncementBar initialAnnouncement={announcement(surfaces)} surface="mobile" />);
    expect(bar()).toBeInTheDocument();
  });
});
