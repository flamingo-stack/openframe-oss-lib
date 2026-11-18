/**
 * OpenFrame's record types: each kind of thing a person attaches to a message or the agent names in one, and the type
 * its record link carries (`record://device/<id>`). The ONE copy for every web chat; the Java agent's `ContextItemType`
 * and its `marker()` are the other side, matched by name.
 *
 * The kind is what the structured `contextItems[].type` field carries (the `ContextItemType` GraphQL enum, UPPERCASE);
 * the record type is what a record link writes. Three are not a lowercase of their kind (`KB_ARTICLE` → `kb`,
 * `KB_FOLDER` → `kbFolder`, `SCHEDULED_SCRIPT` → `scheduledScript`), and the agent matches the type verbatim, so the
 * case is kept end to end.
 */

export const OPENFRAME_RECORD_KIND = {
  DEVICE: 'DEVICE',
  SCRIPT: 'SCRIPT',
  TICKET: 'TICKET',
  ORGANIZATION: 'ORGANIZATION',
  USER: 'USER',
  KB_ARTICLE: 'KB_ARTICLE',
  KB_FOLDER: 'KB_FOLDER',
  POLICY: 'POLICY',
  QUERY: 'QUERY',
  SCHEDULED_SCRIPT: 'SCHEDULED_SCRIPT',
  /** An incident (the API's `Insight`), by its stored id. */
  INSIGHT: 'INSIGHT',
  /** A software title of the fleet inventory, by the inventory's own id. */
  SOFTWARE: 'SOFTWARE',
  /** A CVE, by its `cveId` (`CVE-2024-38063`), which is also its name. */
  VULNERABILITY: 'VULNERABILITY',
} as const;

export type OpenFrameRecordKind = (typeof OPENFRAME_RECORD_KIND)[keyof typeof OPENFRAME_RECORD_KIND];

/** Every kind, in declaration order. */
export const OPENFRAME_RECORD_KINDS = Object.values(OPENFRAME_RECORD_KIND) as OpenFrameRecordKind[];

/** Each kind's record type: the `<type>` of its record link. */
export const OPENFRAME_RECORD_TYPE: Record<OpenFrameRecordKind, string> = {
  DEVICE: 'device',
  SCRIPT: 'script',
  TICKET: 'ticket',
  ORGANIZATION: 'organization',
  USER: 'user',
  KB_ARTICLE: 'kb',
  KB_FOLDER: 'kbFolder',
  POLICY: 'policy',
  QUERY: 'query',
  SCHEDULED_SCRIPT: 'scheduledScript',
  INSIGHT: 'insight',
  SOFTWARE: 'software',
  VULNERABILITY: 'vulnerability',
};

/** An earlier conversation the agent recalls from chat memory (`record://chat/<id>`): not an entity, it opens a chat. */
export const OPENFRAME_CHAT_RECORD_TYPE = 'chat';

const KIND_BY_TYPE = new Map<string, OpenFrameRecordKind>(
  OPENFRAME_RECORD_KINDS.map(kind => [OPENFRAME_RECORD_TYPE[kind], kind]),
);

/** The kind a record link's type names, or undefined for a type that is not an OpenFrame record. */
export function openFrameRecordKindOf(type: string): OpenFrameRecordKind | undefined {
  return KIND_BY_TYPE.get(type);
}
