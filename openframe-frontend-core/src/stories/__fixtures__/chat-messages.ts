import {
  APPROVAL_CANCELLED,
  type ChatMessage,
  type ChatMessageAuthor,
  type ChatPart,
  type ChatToolPart,
} from '../../chat-protocol/chat-message';

/** A thread's row as a story writes it: who speaks, when, and the message's parts. */
export type StoryRow = ChatMessageAuthor & {
  id: string;
  role: ChatMessage['role'];
  timestamp?: Date;
  parts: ChatPart[];
};

export function storyMessage({ id, role, timestamp, parts, ...author }: StoryRow): ChatMessage {
  return {
    id,
    role,
    metadata: { ...(timestamp ? { createdAt: timestamp.toISOString() } : {}), author },
    parts,
  };
}

/** A message's one text part. */
export const textPart = (text: string): ChatPart[] => (text ? [{ type: 'text', text }] : []);

/** A single approval's card. `status` other than pending draws it answered. */
export function approvalPart(spec: {
  id: string;
  command: string;
  explanation?: string;
  approvalType?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  resolvedByName?: string;
}): ChatToolPart {
  const { id, command, explanation, approvalType, status = 'pending', resolvedByName } = spec;
  const request = {
    id,
    ...(explanation ? { requestReason: explanation } : {}),
    ...(approvalType ? { descriptor: { approvalType } } : {}),
  };
  const base = {
    type: 'dynamic-tool' as const,
    toolName: 'run_script',
    toolCallId: id,
    title: command,
    input: {},
    ...(resolvedByName ? { toolMetadata: { resolvedByName } } : {}),
  };
  if (status === 'pending') return { ...base, state: 'approval-requested', approval: request };
  if (status === 'approved') return { ...base, state: 'approval-responded', approval: { ...request, approved: true } };
  return {
    ...base,
    state: 'output-denied',
    approval: { ...request, approved: false, ...(status === 'cancelled' ? { reason: APPROVAL_CANCELLED } : {}) },
  };
}
