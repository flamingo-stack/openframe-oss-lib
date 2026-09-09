/**
 * Source-metadata payload → `{ sources, refs }`.
 *
 * ONE decoder for two arrival paths: the live `GUIDE`/`SOURCES` NATS chunk and
 * the persisted row of the same name in dialog history. That is the whole point
 * of putting it here rather than in either consumer — a reloaded thread has to
 * render identically to the live turn, and two parsers is exactly how that stops
 * being true.
 *
 * Everything is validated, and anything that fails is DROPPED rather than
 * repaired: this payload is assembled from a remote MCP server's tool output,
 * so a malformed row means an upstream contract slip, and rendering a chip with
 * a blank title or a link to a non-https URL is worse than rendering nothing.
 *
 * Server-safe: no React, no browser APIs beyond `URL`.
 */

import type { ChatRef } from '../components/chat/chat-ref.types';
import type { ChatSource } from '../components/chat/types/message.types';
import { CARD_REFERENCE } from './card-marker';
import type { SourcesEvent } from './events';
import { isRecord } from './wire-narrow';

/** YouTube ids are exactly 11 chars of the URL-safe alphabet. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Video URL fields carried through verbatim, once validated as https. */
const VIDEO_URL_KEYS = ['videoUrl', 'highlightVideoUrl', 'videoPoster', 'highlightVideoPoster'] as const;

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * `null` survives, anything non-string becomes `undefined`.
 *
 * The distinction is load-bearing for `targetPlatform` and `path`, where the
 * backend uses an explicit `null` to mean "this row has no destination" — which
 * downstream navigation treats differently from "the field was not sent".
 */
function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : text(value);
}

/** An https URL, or nothing. Plain http and non-URLs are dropped — these become
 *  hrefs and video sources in the panel. */
function httpsUrl(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  try {
    return new URL(candidate).protocol === 'https:' ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A YouTube video id, from either a bare id or any of the watch/short/embed URL
 * shapes. Returns the ID, never a URL — the player takes an id.
 */
export function youtubeVideoId(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  if (YOUTUBE_ID.test(candidate)) return candidate;

  const url = httpsUrl(candidate);
  if (!url) return undefined;
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const isYoutubeHost = hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  if (!isYoutubeHost) return undefined;

  const fromPath =
    hostname === 'youtu.be'
      ? parsed.pathname.split('/').filter(Boolean)[0]
      : /^\/(?:embed|v|shorts)\/([A-Za-z0-9_-]{11})(?:\/|$)/.exec(parsed.pathname)?.[1];
  const id = fromPath ?? parsed.searchParams.get('v') ?? undefined;
  return id && YOUTUBE_ID.test(id) ? id : undefined;
}

function sourceItems(value: unknown): NonNullable<ChatSource['items']> | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(isRecord).flatMap(item => {
    const id = text(item.id);
    const documentType = text(item.documentType);
    const name = text(item.name);
    // A grouped row without these three has nothing to render OR navigate with.
    if (!id || !documentType || !name) return [];

    const externalUrl = httpsUrl(item.externalUrl);
    const targetPlatform = nullableText(item.targetPlatform);
    const path = nullableText(item.path);
    return [
      {
        id,
        documentType,
        name,
        ...(externalUrl ? { externalUrl } : {}),
        ...(targetPlatform !== undefined ? { targetPlatform } : {}),
        ...(path !== undefined ? { path } : {}),
      },
    ];
  });
  return items.length > 0 ? items : undefined;
}

/**
 * Cited documents, keyed by their citation number.
 *
 * `index` and `name` are required because they ARE the chip: the number the
 * answer's `[1]` refers to, and the text on it. `path` is NOT required — it is
 * one of several ways a chip resolves a destination (an `externalUrl` or a
 * grouped item can carry it instead), and a source is still worth showing when
 * it has none.
 *
 * A duplicate `index` keeps the first occurrence: two chips answering to the
 * same `[1]` is not a state the strip can render meaningfully.
 */
function sources(value: unknown): ChatSource[] {
  if (!Array.isArray(value)) return [];
  const claimed = new Set<number>();
  const decoded: ChatSource[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const index = candidate.index;
    const name = text(candidate.name);
    const isUsableIndex = typeof index === 'number' && Number.isInteger(index) && index > 0 && !claimed.has(index);
    if (!isUsableIndex || !name) continue;
    claimed.add(index);

    const path = text(candidate.path);
    const documentType = text(candidate.documentType);
    const externalUrl = httpsUrl(candidate.externalUrl);
    const targetPlatform = nullableText(candidate.targetPlatform);
    const id = text(candidate.id);
    const sourceRepo = text(candidate.sourceRepo);
    const label = text(candidate.label);
    const items = sourceItems(candidate.items);

    decoded.push({
      index,
      name,
      // Both are typed non-optional on `ChatSource` and predate this decoder;
      // '' is the established "no value" for them across the SSE path.
      path: path ?? '',
      documentType: documentType ?? '',
      ...(externalUrl ? { externalUrl } : {}),
      ...(targetPlatform !== undefined ? { targetPlatform } : {}),
      ...(id ? { id } : {}),
      ...(sourceRepo ? { sourceRepo } : {}),
      ...(label ? { label } : {}),
      ...(items ? { items } : {}),
    });
  }
  return decoded;
}

/**
 * Player metadata for a video ref, in the key vocabulary the card dispatcher
 * already reads (`itemVideoMetadata` / `decodeVideoMarkerId` in
 * `entity-cards/dispatch.tsx`).
 *
 * `youtubeUrl` holds a bare video ID, not a URL. The name is inaccurate and
 * predates this decoder — but it is the established key on both the producing
 * and the consuming side, and a more honest name here would simply be a field
 * nothing reads. Renaming it is a separate change that has to move both ends at
 * once.
 *
 * `videoUrl` and `youtubeUrl` stay mutually exclusive: they select different
 * players (a `<video>`/HLS source vs an embed facade), so carrying both would
 * make the renderer guess.
 */
function videoMetadata(value: unknown, url: string | null): Record<string, string> {
  const metadata: Record<string, string> = {};
  if (isRecord(value)) {
    for (const key of VIDEO_URL_KEYS) {
      const validated = httpsUrl(value[key]);
      if (validated) metadata[key] = validated;
    }
    const declaredId = youtubeVideoId(value.youtubeUrl);
    if (declaredId) metadata.youtubeUrl = declaredId;
  }

  // The top-level `url` is the authority when present: it is what the backend
  // resolved for THIS video, while `metadata` is passthrough from the row.
  if (url) {
    const idFromUrl = youtubeVideoId(url);
    if (idFromUrl) {
      metadata.youtubeUrl = idFromUrl;
      delete metadata.videoUrl;
    } else {
      metadata.videoUrl = url;
      delete metadata.youtubeUrl;
    }
  }
  return metadata;
}

/** Video references. `ref` must parse AND be of type `video` — a mistyped row
 *  would otherwise render through the entity-card path with no player. */
function videos(value: unknown): ChatRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap(video => {
    const match = typeof video.ref === 'string' ? CARD_REFERENCE.exec(video.ref) : null;
    if (!match || match[1] !== 'video') return [];

    const id = match[2];
    const url = httpsUrl(video.url) ?? null;
    const sourceRepo = text(video.sourceRepo);
    const metadata = videoMetadata(video.metadata, url);
    return [
      {
        type: 'video',
        id,
        title: text(video.title) ?? id,
        url,
        ...(sourceRepo ? { sourceRepo } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
    ];
  });
}

/**
 * Entity-card references, enriched from `sources` where the two describe the
 * same row.
 *
 * A card carries only `type` + `id` on the wire; its human title and link live
 * on the matching source. Without the match the card still renders — with its
 * id as the title, which is ugly but honest, and better than dropping a card
 * the answer text explicitly points at.
 *
 * `entityType`/`entityId` are cross-checked against the parsed `ref` because
 * they are three statements of the same fact, and a disagreement means the row
 * was assembled wrongly upstream.
 */
function cards(value: unknown, decodedSources: ChatSource[]): ChatRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap(card => {
    const match = typeof card.ref === 'string' ? CARD_REFERENCE.exec(card.ref) : null;
    // `video` is handled by `videos()`; a card claiming that type would render
    // the wrong component.
    if (!match || match[1] === 'video') return [];

    const type = text(card.entityType);
    const id = text(card.entityId);
    if (!type || !id || type !== match[1] || id !== match[2]) return [];

    const source = decodedSources.find(candidate => candidate.id === id && candidate.documentType === type);
    return [
      {
        type,
        id,
        title: source?.name ?? id,
        url: source?.externalUrl ?? null,
        ...(source?.sourceRepo ? { sourceRepo: source.sourceRepo } : {}),
        ...(source?.targetPlatform !== undefined ? { targetPlatform: source.targetPlatform } : {}),
        ...(source?.path ? { metadata: { path: source.path } } : {}),
      },
    ];
  });
}

/** Last `type:id` wins nothing — the FIRST occurrence is kept, so a payload that
 *  lists a card twice cannot flip which copy the body expands to. */
function deduplicateRefs(refs: ChatRef[]): ChatRef[] {
  const byIdentity = new Map<string, ChatRef>();
  for (const ref of refs) {
    const identity = `${ref.type}:${ref.id}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, ref);
  }
  return [...byIdentity.values()];
}

/**
 * Decode one source-metadata payload into its event, or `null` when there is
 * nothing usable in it.
 *
 * Returning `null` for an empty result matters: the reducer stamps this onto a
 * message, and an event carrying two empty arrays would overwrite metadata that
 * an earlier chunk of the same turn had already supplied.
 */
export function sourceMetadataEvent(payload: unknown): SourcesEvent | null {
  if (!isRecord(payload)) return null;

  const decodedSources = sources(payload.sources);
  const refs = deduplicateRefs([...videos(payload.videos), ...cards(payload.cards, decodedSources)]);
  if (decodedSources.length === 0 && refs.length === 0) return null;

  return {
    type: 'sources',
    ...(decodedSources.length > 0 ? { sources: decodedSources } : {}),
    ...(refs.length > 0 ? { refs } : {}),
  };
}

/** What one assistant answer carries: its citations and its expandable refs. */
export interface SourceMetadata {
  sources?: ChatSource[];
  refs?: ChatRef[];
}

/**
 * Fold one decoded chunk into an answer's accumulated metadata.
 *
 * A single turn can call several remote tools, each returning its own metadata,
 * so this merges rather than replaces — and it is shared by the live reducer and
 * the history replay precisely because those two must agree on what a reloaded
 * answer shows.
 *
 * First writer wins per identity (`index` for a source, `type:id` for a ref),
 * the same rule the decoder applies within one payload.
 *
 * KNOWN LIMIT: citation numbers are assigned per tool result, so two tool calls
 * in one turn can both claim `[1]`. The later source is dropped rather than
 * renumbered — by then the numbers are already written into the answer text,
 * and renumbering would point `[1]` at a document the sentence is not about.
 */
export function mergeSourceMetadata(previous: SourceMetadata | null, event: SourcesEvent): SourceMetadata {
  const byIndex = new Map<number, ChatSource>();
  for (const source of [...(previous?.sources ?? []), ...(event.sources ?? [])]) {
    if (!byIndex.has(source.index)) byIndex.set(source.index, source);
  }
  const byIdentity = new Map<string, ChatRef>();
  for (const ref of [...(previous?.refs ?? []), ...(event.refs ?? [])]) {
    const identity = `${ref.type}:${ref.id}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, ref);
  }
  return {
    ...(byIndex.size > 0 ? { sources: [...byIndex.values()] } : {}),
    ...(byIdentity.size > 0 ? { refs: [...byIdentity.values()] } : {}),
  };
}
