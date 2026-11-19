/**
 * A tool row the server marked as the turn's answer (`toolMetadata.resultIsAnswer`) shows its result, as the tool
 * returned it, right after the row.
 *
 * An OpenFrame slash command forces one MCP tool and returns its result as is: the model is not asked to rewrite it, and
 * the agent marks that row. Its result is the MCP tool's structured content, drawn with the parts the chat already has,
 * in this order:
 * - `text` (a string) as text;
 * - `groups` (quick actions: `label` over `prompts` of `label`, `prompt` and standard MCP `icons`) as `data-suggestions`;
 * - every record it lists (a source part: `source-url` or `source-document` with a `record://` `sourceId`) as
 *   `data-record-cards`, beside its source part, which gives the card its title and link;
 * - `note` (a string) as text.
 *
 * Every other tool row stays a row: only the server says a result is the answer.
 */
import type { ChatPart, ChatSourcePart, ChatSuggestionGroup, ChatSuggestionPrompt, ChatToolPart } from './chat-message';
import { isToolPart } from './chat-message';
import { normalizeRecordUri } from './record-link';

type JsonObject = Record<string, unknown>;

/** A host theme an MCP icon is drawn for. The chat is dark: an icon drawn for a dark host reads on it. */
const CHAT_ICON_THEME = 'dark';

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** The tool's structured result: an object, or the JSON of one (a stored result is its text). */
function structuredResultOf(output: unknown): JsonObject | null {
  if (isObject(output)) return output;
  if (typeof output !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(output);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The icon of a quick action: the image MCP names for a dark host, else its first. */
function iconOf(icons: unknown): ChatSuggestionPrompt['icon'] {
  if (!Array.isArray(icons)) return undefined;
  const images = icons.filter(isObject).filter(icon => str(icon.src));
  const image = images.find(icon => icon.theme === CHAT_ICON_THEME) ?? images[0];
  return image ? { url: image.src as string } : undefined;
}

function promptOf(value: unknown): ChatSuggestionPrompt | null {
  if (!isObject(value)) return null;
  const label = str(value.label);
  if (!label) return null;
  const prompt = str(value.prompt);
  const icon = iconOf(value.icons);
  return { label, ...(prompt ? { prompt } : {}), ...(icon ? { icon } : {}) };
}

function suggestionGroupsOf(groups: unknown): ChatSuggestionGroup[] {
  if (!Array.isArray(groups)) return [];
  return groups.filter(isObject).flatMap(group => {
    const label = str(group.label);
    const prompts = Array.isArray(group.prompts)
      ? group.prompts.map(promptOf).filter((prompt): prompt is ChatSuggestionPrompt => prompt !== null)
      : [];
    return label && prompts.length > 0 ? [{ label, prompts }] : [];
  });
}

function sourcePartOf(value: unknown): ChatSourcePart | null {
  if (!isObject(value)) return null;
  const sourceId = normalizeRecordUri(value.sourceId);
  if (!sourceId) return null;
  const title = str(value.title);
  const url = str(value.url);
  if (value.type === 'source-url' && url) return { type: 'source-url', sourceId, url, ...(title ? { title } : {}) };
  if (value.type === 'source-document' && title) {
    const mediaType = str(value.mediaType) ?? 'text/plain';
    return { type: 'source-document', sourceId, mediaType, title };
  }
  return null;
}

/** Every record the result lists, in its order: each top-level list of source parts, and each one standing alone. */
function sourcePartsOf(result: JsonObject): ChatSourcePart[] {
  const seen = new Set<string>();
  const out: ChatSourcePart[] = [];
  for (const value of Object.values(result)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      const source = sourcePartOf(item);
      if (!source || seen.has(source.sourceId)) continue;
      seen.add(source.sourceId);
      out.push(source);
    }
  }
  return out;
}

/** The parts a tool's structured result is drawn with. Empty for a result that holds nothing to draw. */
export function toolAnswerParts(output: unknown): ChatPart[] {
  const result = structuredResultOf(output);
  if (!result) return [];
  const parts: ChatPart[] = [];
  const text = str(result.text);
  if (text) parts.push({ type: 'text', text });
  const groups = suggestionGroupsOf(result.groups);
  if (groups.length > 0) parts.push({ type: 'data-suggestions', data: { groups } });
  const sources = sourcePartsOf(result);
  if (sources.length > 0) {
    parts.push(...sources, { type: 'data-record-cards', data: { records: sources.map(source => source.sourceId) } });
  }
  const note = str(result.note);
  if (note) parts.push({ type: 'text', text: note });
  return parts;
}

function isAnswerRow(part: ChatPart): part is Extract<ChatToolPart, { state: 'output-available' }> {
  return isToolPart(part) && part.state === 'output-available' && part.toolMetadata?.resultIsAnswer === true;
}

/**
 * The message's parts, with the result of each row marked as the answer drawn right after that row. The same array when
 * no row is marked, or a marked result holds nothing to draw.
 */
export function withToolAnswer(parts: readonly ChatPart[]): readonly ChatPart[] {
  if (!parts.some(isAnswerRow)) return parts;
  const shown: ChatPart[] = [];
  for (const part of parts) {
    shown.push(part);
    if (isAnswerRow(part)) shown.push(...toolAnswerParts(part.output));
  }
  return shown.length === parts.length ? parts : shown;
}
