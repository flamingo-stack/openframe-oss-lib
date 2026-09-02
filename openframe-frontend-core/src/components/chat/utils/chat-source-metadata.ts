import type { ChatRef } from '../chat-ref.types';
import type { ChatSource } from '../types/message.types';

export function mergeChatSources(current: ChatSource[] | undefined, incoming: ChatSource[]): ChatSource[] {
  const sourcesByIndex = new Map((current ?? []).map(source => [source.index, source]));
  incoming.forEach(source => {
    if (!sourcesByIndex.has(source.index)) sourcesByIndex.set(source.index, source);
  });
  return Array.from(sourcesByIndex.values());
}

export function mergeChatRefs(current: ChatRef[] | undefined, incoming: ChatRef[]): ChatRef[] {
  const refsByIdentity = new Map((current ?? []).map(ref => [`${ref.type}:${ref.id}`, ref]));
  incoming.forEach(ref => {
    const identity = `${ref.type}:${ref.id}`;
    if (!refsByIdentity.has(identity)) refsByIdentity.set(identity, ref);
  });
  return Array.from(refsByIdentity.values());
}
