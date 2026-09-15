/**
 * The source-metadata decoder is the ONE parse point for both arrival paths —
 * the live `GUIDE`/`SOURCES` chunk and the persisted row of the same name — so
 * what it accepts is exactly what a reloaded answer will show. These pin the
 * accept/reject line, because every rejection here is a chip, card or video the
 * reader silently does not get.
 */

import { describe, expect, it } from 'vitest';
import { decodeNatsChunk } from '../nats-decoder';
import { mergeSourceMetadata, sourceMetadataEvent, youtubeVideoId } from '../source-metadata';

const AGENT_GUIDE = {
  index: 1,
  name: 'Install the OpenFrame Agent on Windows',
  path: 'onboarding-guides/install-the-openframe-agent-on-windows',
  documentType: 'onboarding_guide',
  externalUrl: 'https://hub.openframe.ai/onboarding-guides/install-the-openframe-agent-on-windows',
  targetPlatform: 'openframe',
  id: '88dd40cc-66f5-4175-be60-6f34b054a5f1',
  sourceRepo: 'onboarding-guides',
};

describe('sourceMetadataEvent', () => {
  it('decodes the documented payload into sources and refs', () => {
    const event = sourceMetadataEvent({
      sources: [AGENT_GUIDE],
      videos: [
        {
          ref: '[card://video:MdFJNoJeqZQ]',
          id: 'MdFJNoJeqZQ',
          title: 'Install the OpenFrame agent on Windows',
          url: 'https://www.youtube.com/watch?v=MdFJNoJeqZQ',
          sourceRepo: 'embedded-videos',
        },
      ],
      cards: [
        {
          ref: '[card://onboarding_guide:88dd40cc-66f5-4175-be60-6f34b054a5f1]',
          entityType: 'onboarding_guide',
          entityId: '88dd40cc-66f5-4175-be60-6f34b054a5f1',
        },
      ],
    });

    expect(event?.sources).toEqual([AGENT_GUIDE]);
    expect(event?.refs).toEqual([
      {
        type: 'video',
        id: 'MdFJNoJeqZQ',
        title: 'Install the OpenFrame agent on Windows',
        url: 'https://www.youtube.com/watch?v=MdFJNoJeqZQ',
        sourceRepo: 'embedded-videos',
        metadata: { youtubeUrl: 'MdFJNoJeqZQ' },
      },
      {
        // Enriched from the matching source: the card itself carries only
        // type + id, so without this the reader sees a UUID for a title.
        type: 'onboarding_guide',
        id: '88dd40cc-66f5-4175-be60-6f34b054a5f1',
        title: 'Install the OpenFrame Agent on Windows',
        url: AGENT_GUIDE.externalUrl,
        sourceRepo: 'onboarding-guides',
        targetPlatform: 'openframe',
        metadata: { path: AGENT_GUIDE.path },
      },
    ]);
  });

  it('keeps a card whose source is missing, titled by its id', () => {
    // Dropping it would leave the `[card://…]` marker in the answer text with
    // nothing to expand — a visibly broken sentence beats a plain-looking card.
    const event = sourceMetadataEvent({
      cards: [{ ref: '[card://device:device-42]', entityType: 'device', entityId: 'device-42' }],
    });
    expect(event?.refs).toEqual([{ type: 'device', id: 'device-42', title: 'device-42', url: null }]);
  });

  it('accepts an id the backend accepts, even with punctuation in it', () => {
    // The backend validates the id half as "anything but ] and newlines". A
    // stricter rule here drops metadata for a marker already written into the body.
    const event = sourceMetadataEvent({
      cards: [{ ref: '[card://markdown:docs/setup.v2.md]', entityType: 'markdown', entityId: 'docs/setup.v2.md' }],
    });
    expect(event?.refs?.[0]).toMatchObject({ type: 'markdown', id: 'docs/setup.v2.md' });
  });

  it('keeps a source that has no path', () => {
    // `path` is one of several ways a chip resolves a destination, not a
    // precondition for showing the citation at all.
    const event = sourceMetadataEvent({ sources: [{ index: 1, name: 'Release notes', documentType: 'blog_post' }] });
    expect(event?.sources).toEqual([{ index: 1, name: 'Release notes', path: '', documentType: 'blog_post' }]);
  });

  it('drops a source with no citation number or no name', () => {
    const event = sourceMetadataEvent({
      sources: [{ name: 'No index' }, { index: 2 }, { index: 0, name: 'Zero' }, { index: 3, name: 'Kept' }],
    });
    expect(event?.sources).toEqual([{ index: 3, name: 'Kept', path: '', documentType: '' }]);
  });

  it('keeps the first source claiming a citation number', () => {
    const event = sourceMetadataEvent({
      sources: [
        { index: 1, name: 'First' },
        { index: 1, name: 'Second' },
      ],
    });
    expect(event?.sources).toHaveLength(1);
    expect(event?.sources?.[0].name).toBe('First');
  });

  it('drops a non-https external URL but keeps the source', () => {
    const event = sourceMetadataEvent({
      sources: [{ index: 1, name: 'Doc', path: 'docs/x', documentType: 'markdown', externalUrl: 'http://x.test/x' }],
    });
    expect(event?.sources?.[0]).not.toHaveProperty('externalUrl');
  });

  it('preserves an explicit null targetPlatform, which means "no destination"', () => {
    const event = sourceMetadataEvent({
      sources: [{ index: 1, name: 'Doc', path: 'docs/x', documentType: 'markdown', targetPlatform: null }],
    });
    expect(event?.sources?.[0].targetPlatform).toBeNull();
  });

  it('drops malformed video and card rows', () => {
    const event = sourceMetadataEvent({
      videos: [{ ref: 'card://video:x' }, { id: 'no-ref' }, { ref: '[card://video:ok]' }],
      cards: [
        // entityType disagrees with the parsed ref — the row was built wrongly.
        { ref: '[card://faq:a]', entityType: 'blog_post', entityId: 'a' },
        // a card must not claim the video type: it would render without a player
        { ref: '[card://video:b]', entityType: 'video', entityId: 'b' },
      ],
    });
    expect(event?.refs).toEqual([{ type: 'video', id: 'ok', title: 'ok', url: null }]);
  });

  it('keeps the first ref per type:id', () => {
    const event = sourceMetadataEvent({
      videos: [
        { ref: '[card://video:a]', title: 'First' },
        { ref: '[card://video:a]', title: 'Second' },
      ],
    });
    expect(event?.refs).toHaveLength(1);
    expect(event?.refs?.[0].title).toBe('First');
  });

  it('carries a YouTube video as a bare id under the dispatcher’s key', () => {
    // `youtubeUrl` holding an ID is the lib's existing vocabulary — see the
    // note on `videoMetadata`. The card dispatcher reads exactly this key.
    const event = sourceMetadataEvent({
      videos: [{ ref: '[card://video:MdFJNoJeqZQ]', url: 'https://youtu.be/MdFJNoJeqZQ' }],
    });
    expect(event?.refs?.[0].metadata).toEqual({ youtubeUrl: 'MdFJNoJeqZQ' });
  });

  it('routes a non-YouTube video URL to the plain player', () => {
    // Mux/HLS and direct mp4 are played as a video source, not an embed.
    const hls = sourceMetadataEvent({
      videos: [{ ref: '[card://video:mux-9b]', url: 'https://stream.mux.com/install-agent.m3u8' }],
    });
    expect(hls?.refs?.[0].metadata).toEqual({ videoUrl: 'https://stream.mux.com/install-agent.m3u8' });

    const mp4 = sourceMetadataEvent({ videos: [{ ref: '[card://video:v1]', url: 'https://cdn.test/a.mp4' }] });
    expect(mp4?.refs?.[0].metadata).toEqual({ videoUrl: 'https://cdn.test/a.mp4' });
  });

  it('returns null when nothing survives, so it cannot blank earlier metadata', () => {
    expect(sourceMetadataEvent({ sources: [], videos: [], cards: [] })).toBeNull();
    expect(sourceMetadataEvent({ sources: [{ name: 'no index' }] })).toBeNull();
    expect(sourceMetadataEvent(null)).toBeNull();
    expect(sourceMetadataEvent('nope')).toBeNull();
  });
});

describe('youtubeVideoId', () => {
  it.each([
    ['MdFJNoJeqZQ', 'a bare id'],
    ['https://www.youtube.com/watch?v=MdFJNoJeqZQ', 'a watch URL'],
    ['https://youtu.be/MdFJNoJeqZQ', 'a short link'],
    ['https://www.youtube.com/shorts/MdFJNoJeqZQ', 'a shorts URL'],
    ['https://www.youtube.com/embed/MdFJNoJeqZQ', 'an embed URL'],
  ])('reads %s (%s)', value => {
    expect(youtubeVideoId(value)).toBe('MdFJNoJeqZQ');
  });

  it.each([
    ['https://vimeo.com/12345', 'another host'],
    ['http://www.youtube.com/watch?v=MdFJNoJeqZQ', 'plain http'],
    ['https://www.youtube.com/watch?v=short', 'an id of the wrong length'],
    ['', 'nothing'],
  ])('rejects %s (%s)', value => {
    expect(youtubeVideoId(value)).toBeUndefined();
  });
});

describe('decodeNatsChunk — source metadata', () => {
  it('decodes both chunk names through the same path', () => {
    const payload = { sources: [{ index: 1, name: 'Doc', path: 'docs/x', documentType: 'markdown' }] };
    const guide = decodeNatsChunk({ type: 'GUIDE', payload, streamSeq: 7 });
    const sources = decodeNatsChunk({ type: 'SOURCES', payload, streamSeq: 7 });

    expect(guide).toEqual({ type: 'sources', sources: payload.sources, seq: 7 });
    expect(sources).toEqual(guide);
  });

  it('drops a chunk with an empty payload rather than emitting an empty event', () => {
    expect(decodeNatsChunk({ type: 'GUIDE', payload: {} })).toBeNull();
    expect(decodeNatsChunk({ type: 'GUIDE' })).toBeNull();
  });
});

describe('mergeSourceMetadata', () => {
  const first = { type: 'sources' as const, sources: [{ index: 1, name: 'First', path: '', documentType: '' }] };

  it('unions the metadata of several tool calls in one turn', () => {
    const merged = mergeSourceMetadata(mergeSourceMetadata(null, first), {
      type: 'sources',
      sources: [{ index: 2, name: 'Second', path: '', documentType: '' }],
      refs: [{ type: 'video', id: 'v1', title: 'V', url: null }],
    });

    expect(merged.sources?.map(s => s.index)).toEqual([1, 2]);
    expect(merged.refs).toHaveLength(1);
  });

  it('keeps the first claimant of a citation number', () => {
    // Numbers are assigned per tool result, so two calls can both claim [1].
    // The text already says [1]; renumbering would re-point the sentence.
    const merged = mergeSourceMetadata(mergeSourceMetadata(null, first), {
      type: 'sources',
      sources: [{ index: 1, name: 'Collides', path: '', documentType: '' }],
    });
    expect(merged.sources).toEqual(first.sources);
  });

  it('starts from nothing without inventing empty arrays', () => {
    expect(mergeSourceMetadata(null, { type: 'sources' })).toEqual({});
  });
});
