/**
 * The client's checks on OpenFrame attachments: the real type from the magic bytes (a renamed `.exe` stays out), the
 * size, and the per-message and per-chat counts, per profile.
 */

import { describe, expect, it } from 'vitest';
import {
  OPENFRAME_FAE_ATTACHMENT_PROFILE,
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
} from '../../../../chat-protocol/attachment-profiles';
import { validateOpenFrameAttachments } from '../openframe-attachment-validation';

const PNG = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1,
];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PDF = Array.from('%PDF-1.7\n%âã\n', c => c.charCodeAt(0) & 0xff);
const EXE = [0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0];
const ZIP = [
  0x50,
  0x4b,
  0x03,
  0x04,
  0x14,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  5,
  0,
  0,
  0,
  ...Array.from('a.txt', c => c.charCodeAt(0)),
];
const MP4 = [
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f,
  0x6d,
];

/** A stored (uncompressed) zip entry: enough of a zip for the magic-byte reader. */
function zipEntry(name: string, body: string): number[] {
  const nameBytes = Array.from(new TextEncoder().encode(name));
  const bodyBytes = Array.from(new TextEncoder().encode(body));
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [...u16(n & 0xffff), ...u16(n >>> 16)];
  return [
    ...u32(0x04034b50),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...u32(bodyBytes.length),
    ...u32(bodyBytes.length),
    ...u16(nameBytes.length),
    ...u16(0),
    ...nameBytes,
    ...bodyBytes,
  ];
}

/** A minimal Office document: `[Content_Types].xml` naming the main part, then the part. */
function office(kind: 'wordprocessingml.document' | 'spreadsheetml.sheet', part: string): number[] {
  const types = `<Types><Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${kind}.main+xml"/></Types>`;
  return [...zipEntry('[Content_Types].xml', types), ...zipEntry(part, '<x/>')];
}

function file(name: string, bytes: number[] | string, type = ''): File {
  const body = typeof bytes === 'string' ? bytes : new Uint8Array(bytes);
  return new File([body], name, { type });
}

const none = { messageFileCount: 0, chatFileCount: 0 };

async function verdict(f: File, profile = OPENFRAME_FAE_ATTACHMENT_PROFILE) {
  const [result] = await validateOpenFrameAttachments([f], profile, none);
  return result.ok ? `ok:${result.mediaType}` : result.error;
}

describe('validateOpenFrameAttachments: real type', () => {
  it('accepts images and PDF by their magic bytes', async () => {
    expect(await verdict(file('screen.png', PNG))).toBe('ok:image/png');
    expect(await verdict(file('photo.jpeg', JPEG))).toBe('ok:image/jpeg');
    expect(await verdict(file('report.pdf', PDF))).toBe('ok:application/pdf');
  });

  it('refuses an executable renamed .png', async () => {
    expect(await verdict(file('outlook-error.png', EXE, 'image/png'))).toBe('TYPE_NOT_ALLOWED');
  });

  it('refuses an executable renamed .txt (a signature wins over a text extension)', async () => {
    expect(await verdict(file('notes.txt', EXE, 'text/plain'))).toBe('TYPE_NOT_ALLOWED');
  });

  it('refuses a blocked extension whatever the content', async () => {
    expect(await verdict(file('setup.exe', PNG))).toBe('TYPE_NOT_ALLOWED');
    expect(await verdict(file('run.ps1', 'Get-Process'))).toBe('TYPE_NOT_ALLOWED');
  });

  it('refuses archives and video (v1), also renamed', async () => {
    expect(await verdict(file('bundle.zip', ZIP))).toBe('TYPE_NOT_ALLOWED');
    expect(await verdict(file('bundle.log', ZIP))).toBe('TYPE_NOT_ALLOWED');
    expect(await verdict(file('screen.mp4', MP4))).toBe('TYPE_NOT_ALLOWED');
  });

  it('lets archives in when the profile switch is on', async () => {
    expect(await verdict(file('bundle.zip', ZIP), { ...OPENFRAME_MINGO_ATTACHMENT_PROFILE, allowArchives: true })).toBe(
      'ok:application/zip',
    );
  });

  it('accepts text types by extension when the content reads as text', async () => {
    expect(await verdict(file('dns-trace.log', 'nslookup outlook.office365.com\n→ 52.97.x.x (ok)\n'))).toBe(
      'ok:text/plain',
    );
    expect(await verdict(file('export.csv', 'a,b\n1,2\n'))).toBe('ok:text/csv');
    expect(await verdict(file('data.json', '{"a":1}'))).toBe('ok:application/json');
  });

  it('refuses binary content under a text extension, and a picture with no picture bytes', async () => {
    expect(await verdict(file('dump.log', [1, 2, 0, 4, 5]))).toBe('TYPE_NOT_ALLOWED');
    expect(await verdict(file('fake.png', 'not a png'))).toBe('TYPE_NOT_ALLOWED');
  });

  it('keeps DOCX and XLSX to Mingo', async () => {
    const docx = office('wordprocessingml.document', 'word/document.xml');
    const xlsx = office('spreadsheetml.sheet', 'xl/workbook.xml');
    expect(await verdict(file('report.docx', docx), OPENFRAME_MINGO_ATTACHMENT_PROFILE)).toBe(
      'ok:application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(await verdict(file('sheet.xlsx', xlsx), OPENFRAME_MINGO_ATTACHMENT_PROFILE)).toBe(
      'ok:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(await verdict(file('report.docx', docx), OPENFRAME_FAE_ATTACHMENT_PROFILE)).toBe('TYPE_NOT_ALLOWED');
    // A zip that is not an Office document is a zip on both.
    expect(await verdict(file('report.docx', ZIP), OPENFRAME_MINGO_ATTACHMENT_PROFILE)).toBe('TYPE_NOT_ALLOWED');
    expect(await verdict(file('report.docx', ZIP), OPENFRAME_FAE_ATTACHMENT_PROFILE)).toBe('TYPE_NOT_ALLOWED');
  });
});

describe('validateOpenFrameAttachments: size and counts', () => {
  it('refuses a file over 20 MB before reading it', async () => {
    const big = new File([new Uint8Array(21 * 1024 * 1024)], 'mailbox-audit-export.csv');
    expect(await verdict(big)).toBe('TOO_LARGE');
    const exact = new File([new Uint8Array(20 * 1024 * 1024)], 'exact.txt');
    expect(await verdict(exact)).toBe('TYPE_NOT_ALLOWED'); // 20 MB of NUL bytes is no text, but not too large
  });

  it('refuses the 11th file of a message', async () => {
    const files = Array.from({ length: 11 }, (_, i) => file(`f${i}.txt`, 'hello'));
    const results = await validateOpenFrameAttachments(files, OPENFRAME_FAE_ATTACHMENT_PROFILE, none);
    expect(results.filter(r => r.ok)).toHaveLength(10);
    expect(results[10]).toMatchObject({ ok: false, error: 'MESSAGE_LIMIT' });
  });

  it('counts the files already staged in the message', async () => {
    const results = await validateOpenFrameAttachments(
      [file('a.txt', 'x'), file('b.txt', 'y')],
      OPENFRAME_FAE_ATTACHMENT_PROFILE,
      {
        messageFileCount: 9,
        chatFileCount: 9,
      },
    );
    expect(results.map(r => (r.ok ? 'ok' : r.error))).toEqual(['ok', 'MESSAGE_LIMIT']);
  });

  it('refuses the 21st file of a chat', async () => {
    const results = await validateOpenFrameAttachments(
      [file('a.txt', 'x'), file('b.txt', 'y')],
      OPENFRAME_MINGO_ATTACHMENT_PROFILE,
      {
        messageFileCount: 0,
        chatFileCount: 19,
      },
    );
    expect(results.map(r => (r.ok ? 'ok' : r.error))).toEqual(['ok', 'CHAT_LIMIT']);
  });

  it('gives a refused file no slot', async () => {
    const results = await validateOpenFrameAttachments(
      [file('setup.exe', EXE), file('a.txt', 'x')],
      OPENFRAME_FAE_ATTACHMENT_PROFILE,
      {
        messageFileCount: 9,
        chatFileCount: 0,
      },
    );
    expect(results.map(r => (r.ok ? 'ok' : r.error))).toEqual(['TYPE_NOT_ALLOWED', 'ok']);
  });
});
