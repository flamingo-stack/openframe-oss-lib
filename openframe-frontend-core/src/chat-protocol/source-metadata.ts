import type { ChatRef } from '../components/chat/chat-ref.types';
import type { ChatSource } from '../components/chat/types/message.types';
import type { SourcesEvent } from './events';

const CARD_REFERENCE = /^\[card:\/\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]$/;

function requiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function optionalString(value: unknown): string | undefined {
  return requiredString(value) ?? undefined;
}

function httpsUrl(value: unknown): string | undefined {
  const candidate = optionalString(value);
  if (!candidate) return undefined;
  try {
    return new URL(candidate).protocol === 'https:' ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function youtubeId(value: unknown): string | undefined {
  const candidate = optionalString(value);
  if (!candidate) return undefined;
  if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) return candidate;
  const url = httpsUrl(candidate);
  if (!url) return undefined;
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const youtubeHost = hostname === 'youtu.be' || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  if (!youtubeHost) return undefined;
  const pathId =
    hostname === 'youtu.be'
      ? parsed.pathname.split('/').filter(Boolean)[0]
      : parsed.pathname.match(/^\/(?:embed|v|shorts)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1];
  const id = pathId ?? parsed.searchParams.get('v') ?? undefined;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : optionalString(value);
}

function normalizeSourceItems(value: unknown): NonNullable<ChatSource['items']> | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const id = requiredString(item.id);
    const documentType = requiredString(item.documentType);
    const name = requiredString(item.name);
    if (!id || !documentType || !name) return [];
    const externalUrl = httpsUrl(item.externalUrl);
    const targetPlatform = nullableString(item.targetPlatform);
    const path = nullableString(item.path);
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

function normalizeSources(value: unknown): ChatSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const sources: ChatSource[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const source = candidate as Record<string, unknown>;
    const index = source.index;
    const name = requiredString(source.name);
    const path = requiredString(source.path);
    const documentType = requiredString(source.documentType);
    const validIndex =
      typeof index === 'number' && Number.isFinite(index) && Number.isInteger(index) && index > 0 && !seen.has(index);
    if (!validIndex || !name || !path || !documentType) continue;
    seen.add(index);
    const externalUrl = httpsUrl(source.externalUrl);
    const targetPlatform = nullableString(source.targetPlatform);
    const id = optionalString(source.id);
    const sourceRepo = optionalString(source.sourceRepo);
    const label = optionalString(source.label);
    const items = normalizeSourceItems(source.items);
    sources.push({
      index,
      name,
      path,
      documentType,
      ...(externalUrl ? { externalUrl } : {}),
      ...(targetPlatform !== undefined ? { targetPlatform } : {}),
      ...(id ? { id } : {}),
      ...(sourceRepo ? { sourceRepo } : {}),
      ...(label ? { label } : {}),
      ...(items ? { items } : {}),
    });
  }
  return sources;
}

function normalizeVideoMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  for (const key of ['videoUrl', 'highlightVideoUrl', 'videoPoster', 'highlightVideoPoster'] as const) {
    const url = httpsUrl(input[key]);
    if (url) metadata[key] = url;
  }
  const id = youtubeId(input.youtubeUrl);
  if (id) metadata.youtubeUrl = id;
  return metadata;
}

function normalizeVideos(value: unknown): ChatRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const video = candidate as Record<string, unknown>;
    const match = typeof video.ref === 'string' ? CARD_REFERENCE.exec(video.ref) : null;
    if (!match || match[1] !== 'video') return [];
    const id = match[2];
    const title = optionalString(video.title) ?? id;
    const url = httpsUrl(video.url) ?? null;
    const sourceRepo = optionalString(video.sourceRepo);
    const metadata = normalizeVideoMetadata(video.metadata);
    if (url) {
      const idFromUrl = youtubeId(url);
      if (idFromUrl) {
        metadata.youtubeUrl = idFromUrl;
        delete metadata.videoUrl;
      } else {
        metadata.videoUrl = url;
        delete metadata.youtubeUrl;
      }
    }
    return [
      {
        type: 'video',
        id,
        title,
        url,
        ...(sourceRepo ? { sourceRepo } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
    ];
  });
}

function normalizeCards(value: unknown, sources: ChatSource[]): ChatRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(candidate => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const card = candidate as Record<string, unknown>;
    const match = typeof card.ref === 'string' ? CARD_REFERENCE.exec(card.ref) : null;
    if (!match || match[1] === 'video') return [];
    const type = requiredString(card.entityType);
    const id = requiredString(card.entityId);
    if (!type || !id || type !== match[1] || id !== match[2]) return [];
    const source = sources.find(item => item.id === id && item.documentType === type);
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

export function sourceMetadataEvent(payload: unknown): SourcesEvent | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const metadata = payload as Record<string, unknown>;
  const sources = normalizeSources(metadata.sources);
  const refs = [...normalizeVideos(metadata.videos), ...normalizeCards(metadata.cards, sources)];
  const refsByIdentity = new Map<string, ChatRef>();
  refs.forEach(ref => {
    const identity = `${ref.type}:${ref.id}`;
    if (!refsByIdentity.has(identity)) refsByIdentity.set(identity, ref);
  });
  const uniqueRefs = Array.from(refsByIdentity.values());
  if (sources.length === 0 && uniqueRefs.length === 0) return null;
  return { type: 'sources', sources, ...(uniqueRefs.length > 0 ? { refs: uniqueRefs } : {}) };
}
