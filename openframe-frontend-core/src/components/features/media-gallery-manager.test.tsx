import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MediaGalleryManager, type MediaItem } from './media-gallery-manager';

vi.mock('./video', () => ({ Video: () => null }));

const file = (name: string, body: string, type = 'image/jpeg') => new File([body], name, { type });

function Harness({ initial = [], onUpload }: { initial?: MediaItem[]; onUpload: (file: File) => Promise<string> }) {
  const [media, setMedia] = useState<MediaItem[]>(initial);
  return (
    <>
      <MediaGalleryManager media={media} onChange={setMedia} onUpload={onUpload} />
      <div data-testid="urls">{media.map(item => item.media_url).join('|')}</div>
    </>
  );
}

const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Select media files'), { target: { files } });

describe('MediaGalleryManager', () => {
  it('takes several files in one pick and adds each once', async () => {
    const onUpload = vi.fn((picked: File) => Promise.resolve(`https://cdn.test/g/${picked.name}`));
    render(<Harness onUpload={onUpload} />);
    expect(screen.getByLabelText('Select media files')).toHaveAttribute('multiple');
    pick([file('a.jpg', 'aaa'), file('b.jpg', 'bbb'), file('clip.mp4', 'ccc', 'video/mp4')]);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.getByTestId('urls').textContent).toBe(
        'https://cdn.test/g/a.jpg|https://cdn.test/g/b.jpg|https://cdn.test/g/clip.mp4',
      ),
    );
  });

  it('skips the same bytes picked twice in one batch, whatever the names', async () => {
    const onUpload = vi.fn((picked: File) => Promise.resolve(`https://cdn.test/g/${picked.name}`));
    render(<Harness onUpload={onUpload} />);
    pick([file('a.jpg', 'same'), file('copy-of-a.jpg', 'same')]);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status').textContent).toContain('copy-of-a.jpg');
  });

  it('skips a file already in the gallery, a HEIC stored as a JPEG included', async () => {
    const onUpload = vi.fn((picked: File) => Promise.resolve(`https://cdn.test/g/${picked.name}`));
    const initial: MediaItem[] = [
      { id: 1, media_type: 'image', media_url: 'https://cdn.test/events/x/uuid/IMG_4664.jpg' },
      { id: 2, media_type: 'image', media_url: 'https://cdn.test/events/x/uuid/other.jpg', title: 'Dinner.png' },
    ];
    render(<Harness initial={initial} onUpload={onUpload} />);
    pick([file('IMG_4664.HEIC', 'x', ''), file('Dinner.png', 'y', 'image/png'), file('new.jpg', 'z')]);
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    expect(onUpload.mock.calls[0][0].name).toBe('new.jpg');
    expect(screen.getByRole('status').textContent).toMatch(/IMG_4664\.HEIC, Dinner\.png/);
  });

  it('takes files dropped on the gallery', async () => {
    const onUpload = vi.fn((picked: File) => Promise.resolve(`https://cdn.test/g/${picked.name}`));
    render(<Harness onUpload={onUpload} />);
    const files = [file('d1.jpg', '1'), file('d2.jpg', '2')];
    fireEvent.drop(screen.getByText('Upload Media'), { dataTransfer: { types: ['Files'], files } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
  });

  it('a failed upload adds nothing and says so', async () => {
    const onUpload = vi.fn(() => Promise.resolve(''));
    render(<Harness onUpload={onUpload} />);
    pick([file('a.jpg', 'aaa')]);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Could not upload: a.jpg'));
    expect(screen.getByTestId('urls').textContent).toBe('');
  });
});
