import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Announcement } from '../../types/announcement';
import { AnnouncementBar } from '../announcement-bar';

const announcement: Announcement = {
  id: 'expanded-change-1',
  title: 'New release',
  description: 'Read about it',
  background_color: '#000000',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  surfaces: null,
};

describe('AnnouncementBar onExpandedChange', () => {
  it('reports false when there is nothing to show', () => {
    const onExpandedChange = vi.fn();
    render(<AnnouncementBar initialAnnouncement={null} onExpandedChange={onExpandedChange} />);
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });

  it('reports true while an announcement shows, then false once it is dismissed', () => {
    const onExpandedChange = vi.fn();
    render(<AnnouncementBar initialAnnouncement={announcement} onExpandedChange={onExpandedChange} />);
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });

  it('reports false on a surface the announcement does not list', () => {
    const onExpandedChange = vi.fn();
    render(
      <AnnouncementBar
        initialAnnouncement={{ ...announcement, id: 'expanded-change-2', surfaces: ['web'] }}
        surface="mobile"
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });
});
