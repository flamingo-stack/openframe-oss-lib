import { describe, it, expect } from 'vitest';
import { getPlatformUrl } from '../../../../platform-domains';
import { resolveSourceRowCTA } from '../source-row-cta';

/**
 * Doc-chip CTA resolution — the per-`documentType` `docPlatformTargets` path (the
 * unified, dynamic mechanism) plus the legacy `chipBasePlatform` / in-app `baseRoute`
 * fallbacks. The headline guarantee: a chat surfacing MULTIPLE doc sources routes EACH
 * row to its own home — something a single static fallback cannot do.
 */
describe('resolveSourceRowCTA — doc-chip platform routing', () => {
  const markdownRow = {
    documentType: 'markdown',
    id: 'd1',
    title: 'Install guide',
    path: 'getting-started/install',
  };
  const dataRoomRow = {
    documentType: 'data_room_doc',
    id: 'd2',
    title: 'Cap table',
    path: 'financials/cap-table.pdf',
  };

  const docPlatformTargets = {
    markdown: { platform: 'flamingo', basePath: 'knowledge-base' },
    data_room_doc: { platform: 'company-hub', basePath: 'data-room' },
  };

  const expectHref = (platform: string, base: string, path: string) =>
    new URL(path, `${getPlatformUrl(platform)}/${base}/`).toString();

  it('routes EACH doc source to its own platform from ONE shared context (mixed sources)', () => {
    const md = resolveSourceRowCTA(markdownRow, { docPlatformTargets });
    const dr = resolveSourceRowCTA(dataRoomRow, { docPlatformTargets });

    expect(md.href).toBe(expectHref('flamingo', 'knowledge-base', 'getting-started/install'));
    expect(md.targetPlatform).toBe('flamingo');

    expect(dr.href).toBe(expectHref('company-hub', 'data-room', 'financials/cap-table.pdf'));
    expect(dr.targetPlatform).toBe('company-hub');
  });

  it('tolerates leading/trailing slashes in basePath', () => {
    const md = resolveSourceRowCTA(markdownRow, {
      docPlatformTargets: { markdown: { platform: 'flamingo', basePath: '/knowledge-base/' } },
    });
    expect(md.href).toBe(expectHref('flamingo', 'knowledge-base', 'getting-started/install'));
  });

  it('docPlatformTargets WINS over the legacy chipBasePlatform', () => {
    const md = resolveSourceRowCTA(markdownRow, { docPlatformTargets, chipBasePlatform: 'openframe' });
    expect(md.targetPlatform).toBe('flamingo');
  });

  it('falls back to chipBasePlatform (legacy single) when no docPlatformTargets — hub parity', () => {
    const md = resolveSourceRowCTA(markdownRow, { chipBasePlatform: 'flamingo' });
    expect(md.href).toBe(expectHref('flamingo', 'knowledge-base', 'getting-started/install'));
    expect(md.targetPlatform).toBe('flamingo');
  });

  // CU-17tkuw61kfy: a doc card on the openframe preview opened production hub.openframe.ai. A doc on the platform the
  // chat runs on is a page of the site the reader is on, so its address is relative, like every other link to it.
  it('a doc on the platform the chat runs on gets a relative address, so it stays on this site', () => {
    const md = resolveSourceRowCTA(markdownRow, { docPlatformTargets, currentPlatform: 'flamingo' });
    expect(md.href).toBe('/knowledge-base/getting-started/install');
    expect(md.targetPlatform).toBe('flamingo');
  });

  it("a doc on another platform keeps that platform's address, while the same chat links its own docs relative", () => {
    const md = resolveSourceRowCTA(markdownRow, { docPlatformTargets, currentPlatform: 'flamingo' });
    const dr = resolveSourceRowCTA(dataRoomRow, { docPlatformTargets, currentPlatform: 'flamingo' });
    expect(md.href).toBe('/knowledge-base/getting-started/install');
    expect(dr.href).toBe(expectHref('company-hub', 'data-room', 'financials/cap-table.pdf'));
  });

  it('the legacy chipBasePlatform follows the same rule: relative on its own platform', () => {
    const own = resolveSourceRowCTA(markdownRow, { chipBasePlatform: 'flamingo', currentPlatform: 'flamingo' });
    const other = resolveSourceRowCTA(markdownRow, { chipBasePlatform: 'flamingo', currentPlatform: 'openframe' });
    expect(own.href).toBe('/knowledge-base/getting-started/install');
    expect(other.href).toBe(expectHref('flamingo', 'knowledge-base', 'getting-started/install'));
  });

  it('falls back to an in-app relative path from baseRoute (host serves the viewer)', () => {
    const md = resolveSourceRowCTA(markdownRow, { baseRoute: '/data-room', currentPlatform: 'openmsp' });
    expect(md.href).toBe('/data-room/getting-started/install');
    expect(md.targetPlatform).toBe('openmsp');
  });

  it('no target configured → no href (Ask-only) but still askable', () => {
    const md = resolveSourceRowCTA(markdownRow, {});
    expect(md.href).toBeNull();
    expect(md.askable).toBe(true);
  });

  it('a doc row WITH a public externalUrl skips doc routing and uses the URL verbatim', () => {
    const md = resolveSourceRowCTA({ ...markdownRow, externalUrl: 'https://example.com/x' }, { docPlatformTargets });
    expect(md.href).toBe('https://example.com/x');
  });
});
