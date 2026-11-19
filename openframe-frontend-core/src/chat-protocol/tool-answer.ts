/**
 * A turn that ends on a tool's result shows that result as the answer, as the tool returned it.
 *
 * An OpenFrame slash command forces one MCP tool and returns its result as is (the model is not asked to rewrite it),
 * so the turn ends on the tool part with no text after it. Its result is the MCP tool's structured content, drawn with
 * the parts the chat already has, in this order:
 * - `text` (a string) as text;
 * - `groups` (quick actions: `label` over `prompts` of `label`, `prompt` and standard MCP `icons`) as `data-suggestions`;
 * - every record it lists (a source part: `source-url` or `source-document` with a `record://` `sourceId`) as
 *   `data-record-cards`, beside its source part, which gives the card its title and link;
 * - `note` (a string) as text.
 *
 * A turn with text after its last tool part is an answer the model wrote: its tools stay tool rows.
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

function endsOnToolResult(parts: readonly ChatPart[]): ChatToolPart | null {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    // Words after the tool: the model answered, so the tool is a step of that answer.
    if (part.type === 'text' && part.text.trim() !== '') return null;
    if (isToolPart(part)) return part.state === 'output-available' ? part : null;
  }
  return null;
}

/**
 * The message's parts, with the result of the tool it ends on drawn after that tool's row. The same array when the
 * message does not end on a tool result, or the result holds nothing to draw.
 */
export function withToolAnswer(parts: readonly ChatPart[]): readonly ChatPart[] {
  const last = endsOnToolResult(parts);
  if (!last || last.state !== 'output-available') return parts;
  const answer = toolAnswerParts(last.output);
  return answer.length > 0 ? [...parts, ...answer] : parts;
}
