import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { registerNavigation } from '../../embed-shims/next-navigation';
import type { Announcement } from '../../types/announcement';
import { AnnouncementBar } from '../announcement-bar';

const announcement = (excluded_paths: string[]): Announcement => ({
  id: 'a1',
  title: 'New release',
  description: 'Read about it',
  background_color: '#000000',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  excluded_paths,
});

const onPath = (path: string) => registerNavigation({ usePathname: () => path });

describe('AnnouncementBar excluded paths', () => {
  afterEach(() => onPath('/'));

  it('stays collapsed on a path the announcement excludes, read from the host router', () => {
    onPath('/');
    render(<AnnouncementBar initialAnnouncement={announcement(['/'])} />);
    expect(screen.queryByRole('region', { name: 'Announcement' })).not.toBeInTheDocument();
  });

  it('shows on every other path', () => {
    onPath('/blog/post');
    render(<AnnouncementBar initialAnnouncement={announcement(['/'])} />);
    expect(screen.getByRole('region', { name: 'Announcement' })).toBeInTheDocument();
  });

  it('matches a pattern against the whole path', () => {
    onPath('/blog/post');
    render(<AnnouncementBar initialAnnouncement={announcement(['/blog/.*'])} />);
    expect(screen.queryByRole('region', { name: 'Announcement' })).not.toBeInTheDocument();
  });
});
