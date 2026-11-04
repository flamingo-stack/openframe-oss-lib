/**
 * The contracts the hub owns, read from the hub that serves them (`GET <hub>/api/ci/scripts/<file>`, group
 * `hub-contracts`), never a copy in this package: the chat wire (stream, history and request shapes) and the record-link
 * vectors. Every repository that speaks the wire reads the same bytes, so a shape is spelled once, on the server.
 *
 * Configuration: `FLAMINGO_HUB_BASE_URL` (the hub's origin; locally a preview such as
 * `https://openframe-git-<branch>-flamingocx.vercel.app`) and `FLAMINGO_HUB_SECRET` (the fleet secret in CI, else a
 * personal API key of that deployment). With neither set, outside CI, the tests that read a contract are SKIPPED with
 * a loud warning; with one of the two, or with `FLAMINGO_HUB_CONTRACTS_REQUIRED` set and none, they FAIL. Each file is
 * checked against the sha256 the hub's manifest states for it.
 *
 * Test support only: no entry of this package exports it.
 */

import { createHash } from 'node:crypto';
import type { WireCommandOverride } from '../../components/chat/utils/slash-dispatch-utils';
import type { ChatMessage, ChatPart } from '../chat-message';
import type { UiChunk } from '../ui-chunks';

const BASE_URL = process.env.FLAMINGO_HUB_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
const SECRET = process.env.FLAMINGO_HUB_SECRET?.trim() ?? '';
const REQUIRED = !!process.env.FLAMINGO_HUB_CONTRACTS_REQUIRED?.trim();

const MANIFEST_PATH = '/api/ci/scripts/manifest.json?group=hub-contracts';

/** Whether this run can read the hub's contracts; false means the tests that need them are skipped. */
export const HUB_CONTRACTS_CONFIGURED = (() => {
  if (BASE_URL && SECRET) return true;
  if (BASE_URL || SECRET || REQUIRED) {
    throw new Error(
      'The hub contracts need both FLAMINGO_HUB_BASE_URL and FLAMINGO_HUB_SECRET' +
        (REQUIRED ? ' (FLAMINGO_HUB_CONTRACTS_REQUIRED is set).' : '.'),
    );
  }
  console.warn(
    '\n[hub-contracts] SKIPPING every test that reads a hub contract: FLAMINGO_HUB_BASE_URL and FLAMINGO_HUB_SECRET ' +
      'are not set. Set them (a hub preview and a personal API key of it) to run the chat wire and record-link tests.\n',
  );
  return false;
})();

let manifest: Promise<Record<string, string>> | null = null;

async function hubGet(path: string): Promise<string> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${SECRET}` } });
  if (!response.ok) throw new Error(`[hub-contracts] GET ${path} answered ${response.status}`);
  return response.text();
}

/** One contract file's JSON, checked against the manifest's digest; null when this run cannot read the hub. */
export async function readHubContract<T>(file: string): Promise<T | null> {
  if (!HUB_CONTRACTS_CONFIGURED) return null;
  manifest ??= hubGet(MANIFEST_PATH).then(text => JSON.parse(text) as Record<string, string>);
  const digest = (await manifest)[file];
  if (!digest) throw new Error(`[hub-contracts] the hub's manifest lists no ${file}`);
  const text = await hubGet(`/api/ci/scripts/${encodeURIComponent(file)}`);
  const actual = createHash('sha256').update(text).digest('hex');
  if (actual !== digest)
    throw new Error(`[hub-contracts] ${file} does not match the manifest (${actual} != ${digest})`);
  return JSON.parse(text) as T;
}

/** The record URI and record-link grammar, the cases the lib, the hub and the Java agent all pass. */
export interface RecordLinkVectors {
  uris: { type: string; id: string; href: string }[];
  readHrefs: { href: string; type: string; id: string }[];
  notRecords: string[];
  collections: { type: string; href: string }[];
  markdown: { type: string; id: string; label: string; markdown: string }[];
  links: { text: string; links: { type: string; id: string; label: string }[] }[];
}

/** The chat wire as the hub states it: one value per shape. */
export interface ChatWire {
  FIXTURE_BLOG_URI: string;
  FIXTURE_BLOG_URL: string;
  FIXTURE_TICKET_URI: string;
  FIXTURE_COLLECTION_URI: string;
  FIXTURE_VIDEO_URI: string;
  FIXTURE_TASK_URI: string;
  FIXTURE_CONVERSATION_ID: string;
  FIXTURE_ASSISTANT_ID: string;
  FIXTURE_PROPOSAL_ID: string;
  STORED_ANSWER_PARTS: ChatPart[];
  STORED_USER_PARTS: ChatPart[];
  STORED_RECEIPT_PARTS: ChatPart[];
  HISTORY_RESPONSE: { conversationId: string; found: boolean; messages: ChatMessage[] };
  CHAT_REQUEST_BODY: { id: string; messages: ChatMessage[]; commandOverride: WireCommandOverride };
  ANSWER_STREAM: UiChunk[];
  COLLECTION_CITATION_STREAM: UiChunk[];
  TOOL_ERROR_STREAM: UiChunk[];
  TURN_FAILURE_STREAM: UiChunk[];
  ABORT_STREAM: UiChunk[];
  APPROVAL_STREAM: UiChunk[];
  APPROVAL_BATCH_STREAM: UiChunk[];
  APPROVAL_CARD_MESSAGE: ChatMessage;
  APPROVAL_REQUEST_BODY: { id: string; trigger: 'submit-message'; messages: ChatMessage[] };
  APPROVAL_RESPONSE_STREAM: UiChunk[];
  APPROVAL_REJECT_STREAM: UiChunk[];
  APPROVAL_REFUSED_STREAM: UiChunk[];
  /** Every whole stream that opens with its own message, by name. */
  NEW_MESSAGE_STREAMS: Record<string, UiChunk[]>;
  /** Every whole stream that continues the message holding the card, by name. */
  CARD_MESSAGE_STREAMS: Record<string, UiChunk[]>;
}

type ServedChatWire = Omit<ChatWire, 'NEW_MESSAGE_STREAMS' | 'CARD_MESSAGE_STREAMS'> & {
  NEW_MESSAGE_STREAMS: Record<string, keyof ChatWire>;
  CARD_MESSAGE_STREAMS: Record<string, keyof ChatWire>;
};

/** The served file names each stream of the two groups by its key in the same file (JSON has no references). */
function streamsByName(wire: ServedChatWire, names: Record<string, keyof ChatWire>): Record<string, UiChunk[]> {
  return Object.fromEntries(
    Object.entries(names).map(([name, key]) => {
      const stream = wire[key];
      if (!Array.isArray(stream)) throw new Error(`[hub-contracts] chat-wire.json names no stream ${String(key)}`);
      return [name, stream as UiChunk[]];
    }),
  );
}

export async function readChatWire(): Promise<ChatWire | null> {
  const wire = await readHubContract<ServedChatWire>('chat-wire.json');
  if (!wire) return null;
  return {
    ...wire,
    NEW_MESSAGE_STREAMS: streamsByName(wire, wire.NEW_MESSAGE_STREAMS),
    CARD_MESSAGE_STREAMS: streamsByName(wire, wire.CARD_MESSAGE_STREAMS),
  };
}

export function readRecordLinkVectors(): Promise<RecordLinkVectors | null> {
  return readHubContract<RecordLinkVectors>('record-link-vectors.json');
}
