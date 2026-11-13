import { describe, expect, it } from 'vitest';
import {
  attachmentOfFilePart,
  CHAT_ATTACHMENT_VIEW_URL_PREFIX,
  filePartOfAttachment,
  filePartViewUrl,
  STORAGE_PATH_REGEX,
} from '../attachment';

const PATH = 'chat/2b1f6c3e-8d4a-4f6b-9c1e-5a7d3b2e1f00/screenshot.png';
const ATTACHMENT = { storagePath: PATH, viewToken: 'tok en', contentType: 'image/png', fileName: 'screenshot.png' };

describe('a chat attachment and its file part', () => {
  it('rides as the view proxy under the prefix it is given, and reads back from it', () => {
    const base = `https://www.flamingo.run${CHAT_ATTACHMENT_VIEW_URL_PREFIX}`;
    const part = filePartOfAttachment(ATTACHMENT, base);
    expect(part).toEqual({
      type: 'file',
      mediaType: 'image/png',
      filename: 'screenshot.png',
      url: `${base}${PATH}?t=tok%20en`,
    });
    expect(attachmentOfFilePart({ ...part })).toEqual(ATTACHMENT);
  });

  it('reads one behind a host proxy prefix, or relative', () => {
    const part = {
      type: 'file',
      mediaType: 'image/png',
      url: `/content/api/storage/view/chat-attachments/${PATH}?t=x`,
    };
    expect(attachmentOfFilePart(part)).toEqual({ ...ATTACHMENT, viewToken: 'x' });
  });

  it.each([
    `/api/storage/view/chat-attachments/${PATH}`,
    `/api/storage/view/chat-attachments/chat/2b1f/a.png?t=x`,
    `/api/storage/view/other/${PATH}?t=x`,
  ])('names no attachment: %s', url => {
    expect(attachmentOfFilePart({ type: 'file', mediaType: 'image/png', url })).toBeNull();
  });

  it('holds the storage layout the upload route makes', () => {
    expect(STORAGE_PATH_REGEX.test(PATH)).toBe(true);
    expect(STORAGE_PATH_REGEX.test('chat/../secret')).toBe(false);
  });

  it("is drawn through the host's own prefix", () => {
    expect(
      filePartViewUrl(`https://www.flamingo.run/api/storage/view/chat-attachments/${PATH}?t=x`, '/content/v/'),
    ).toBe(`/content/v/${PATH}?t=x`);
    expect(filePartViewUrl('https://cdn.test/a.png', '/content/v/')).toBe('https://cdn.test/a.png');
  });
});
