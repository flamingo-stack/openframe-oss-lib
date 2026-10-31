/**
 * The inline tokens a chat answer carries, found in the PARSED markdown — ONE walker for both grammars:
 *
 *   - an entity mention `@<marker>:<id>` (`@script:6aad91a3b776f95ad7491bd9`), drawn by the host's `renderMention`;
 *   - a card marker `[card://<type>:<id>]` (grammar: `chat-protocol/card-marker.ts`), drawn by `renderEntityCard`.
 *
 * Each token becomes a synthetic `link` node (`mention://marker:id`, `card://type:id`) that the chat's `<a>` override
 * turns into a chip or a card. The two remark plugins (`remarkMentionChips`, `remarkCardLinks`) are this walker with
 * one grammar each, and `scanChatTokens` runs the same walker for the message's pre-scans (which context items are
 * already inline, where a card's block is hoisted), so a pre-scan can never count a token the body does not draw.
 *
 * What a model actually writes, and what each case becomes:
 *
 *   - a token in plain, bold, italic, struck or table-cell text → the token;
 *   - a token split by markdown on its way in (`[card://blog:a*b*c]` read as emphasis, an id holding an e-mail or a
 *     `www.` that GFM autolinks) → the token: matching runs over the TEXT of a run of siblings, not over one leaf;
 *   - a code span that is exactly one token (`` `@script:6aad…` ``, `` `[card://webinar:42]` ``) → the token: the model
 *     quoted an identifier, it did not mean code;
 *   - a link or a reference link whose whole text is one token (`[@script:6aad…](/scripts/…)`,
 *     `[card://webinar:42](https://…)`) → the token, in place of the link;
 *   - a link the model wrote with the scheme itself (`[Pricing](card://page:pricing)`) → that token;
 *   - a token inside a link with other text, a bare URL, a code block or HTML → left as it is: a link inside a link is
 *     invalid HTML, and a URL that happens to contain `@script:` is a URL.
 *
 * Every produced link records the SOURCE range it replaced (`data.tokenRange`) when it can be computed exactly, which
 * is what lets the card pre-scan cut the raw text at a token without cutting through a code span or a link.
 */

import type { Link, Nodes, Parent, PhrasingContent, Root, Text } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import type { PluggableList, Plugin } from 'unified';
import { unified } from 'unified';

import { CARD_TOKEN_EXACT, createCardMarkerScanner } from '../../chat-protocol/card-marker';

export type ChatTokenKind = 'mention' | 'card';

/** One token found in a message: its grammar, its two halves and where it sits in the source. */
export interface ChatToken {
  kind: ChatTokenKind;
  /** The mention's marker (`script`) or the card's type (`webinar`). */
  type: string;
  id: string;
  /** Source offsets of everything the token replaced (`[start, end)`), or null when they cannot be known exactly. */
  range: [number, number] | null;
  /** True when the raw text may be CUT at this token without breaking the markdown around it: it sits directly in a
   *  paragraph (or a list item's), not inside a table, a heading, a quote or an inline wrapper. Where false, a card
   *  that wants its own block is drawn in place instead of being hoisted out of the text. */
  splittable: boolean;
}

/** A token found in a string: where, and its two halves. */
interface FoundToken {
  start: number;
  end: number;
  type: string;
  id: string;
}

interface TokenGrammar {
  kind: ChatTokenKind;
  /** Every token in a run of text, in order, non-overlapping. */
  find(text: string): FoundToken[];
  /** The token a whole string IS (a code span's value, a link's text), or null. */
  exact(text: string): { type: string; id: string } | null;
  /** The literal a produced link shows when the host draws nothing for it. */
  literal(type: string, id: string): string;
}

/** A mention: `@<marker>:<id>`. The marker is the backend's `ContextItemType.marker()` (mostly lowercase, NOT always:
 *  `scheduledScript`). The id is the composer's token charset, and may not END in `.` or `-`, so a sentence's own
 *  period or dash is never swallowed. A LEFT boundary (start of text, or any char that is neither a word char nor
 *  `@`) keeps an e-mail or a `host:port` from starting a token while `(@device:1)` still does. */
const MENTION_MARKER = '[a-zA-Z]+';
const MENTION_ID = '[A-Za-z0-9_.+/=-]*[A-Za-z0-9_+/=]';
const MENTION_SCANNER = new RegExp(`(^|[^\\w@])@(${MENTION_MARKER}):(${MENTION_ID})`, 'g');
const MENTION_EXACT = new RegExp(`^@(${MENTION_MARKER}):(${MENTION_ID})$`);

export const MENTION_GRAMMAR: TokenGrammar = {
  kind: 'mention',
  find(text) {
    const out: FoundToken[] = [];
    MENTION_SCANNER.lastIndex = 0;
    for (const m of text.matchAll(MENTION_SCANNER)) {
      const start = (m.index ?? 0) + m[1].length;
      out.push({ start, end: (m.index ?? 0) + m[0].length, type: m[2], id: m[3] });
    }
    return out;
  },
  exact(text) {
    const m = MENTION_EXACT.exec(text.trim());
    return m ? { type: m[1], id: m[2] } : null;
  },
  literal: (type, id) => `@${type}:${id}`,
};

export const CARD_GRAMMAR: TokenGrammar = {
  kind: 'card',
  find(text) {
    if (!text.includes('[card://')) return [];
    const out: FoundToken[] = [];
    for (const m of text.matchAll(createCardMarkerScanner())) {
      const start = m.index ?? 0;
      out.push({ start, end: start + m[0].length, type: m[1], id: m[2] });
    }
    return out;
  },
  exact(text) {
    const m = CARD_TOKEN_EXACT.exec(text.trim());
    return m ? { type: m[1], id: m[2] } : null;
  },
  literal: (type, id) => `[card://${type}:${id}]`,
};

const SCHEME: Record<ChatTokenKind, string> = { mention: 'mention://', card: 'card://' };

/** The href a produced link carries. */
function tokenUrl(kind: ChatTokenKind, type: string, id: string): string {
  return `${SCHEME[kind]}${type}:${id}`;
}

/**
 * The two halves of a token href, as the `<a>` override receives it. The markdown → HTML step percent-encodes what a
 * URL may not hold (a space in a card id arrives as `%20`), so the id is decoded here; the type never holds a `:`, so
 * the FIRST colon is the separator (an id may hold more). Null when the href is not a token of that kind.
 */
export function parseTokenHref(kind: ChatTokenKind, href: unknown): { type: string; id: string } | null {
  if (typeof href !== 'string' || !href.startsWith(SCHEME[kind])) return null;
  const rest = href.slice(SCHEME[kind].length);
  const sep = rest.indexOf(':');
  if (sep <= 0) return null;
  return { type: rest.slice(0, sep), id: safeDecode(rest.slice(sep + 1)) };
}

function safeDecode(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The plain text a node shows (what a reader sees of a wrapper). */
function toString(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return (node.children as Nodes[]).map(toString).join('');
  return '';
}

type TokenLink = Link & { data?: Link['data'] & { chatToken?: ChatToken } };

function isTokenLink(node: Nodes): node is TokenLink {
  return node.type === 'link' && (node.url.startsWith(SCHEME.mention) || node.url.startsWith(SCHEME.card));
}

/** A link GFM made from bare text (`https://…`, `www.…`, an e-mail): its text IS its address. Transparent to
 *  matching, so a token whose id GFM autolinked is still one run of text. */
function isAutolinkLiteral(node: Nodes): boolean {
  if (node.type !== 'link' || node.children.length !== 1 || node.children[0].type !== 'text') return false;
  const text = node.children[0].value;
  return node.url === text || node.url === `mailto:${text}` || node.url === `http://${text}`;
}

/** Siblings a token may run across: text and the inline wrappers markdown puts inside it. */
function isTransparent(node: Nodes): boolean {
  if (node.type === 'text' || node.type === 'emphasis' || node.type === 'strong' || node.type === 'delete') return true;
  return isAutolinkLiteral(node);
}

function startOffset(node: Nodes): number | null {
  return node.position?.start.offset ?? null;
}

function endOffset(node: Nodes): number | null {
  return node.position?.end.offset ?? null;
}

/** Source offset of a position inside a child's text, or null when it cannot be known exactly: the child has no
 *  position (GFM's autolink split leaves its pieces without one), or its text and its source differ in length (an
 *  escape, an entity). The two ends of a positioned child are always exact. */
function sourceOffsetIn(node: Nodes, textLength: number, at: number): number | null {
  const start = startOffset(node);
  const end = endOffset(node);
  if (start === null || end === null) return null;
  if (at === 0) return start;
  if (at === textLength) return end;
  if (node.type !== 'text') return null;
  return end - start === textLength ? start + at : null;
}

/** Where a token's literal text sits in its parent's source, when it sits there EXACTLY ONCE: the fallback for a
 *  token whose ends have no exact position. Two occurrences (the same marker also in a code span, say) are not
 *  guessed between. */
function uniqueSourceRange(parent: Parent, literal: string, source: string | undefined): [number, number] | null {
  const from = startOffset(parent as Nodes);
  const to = endOffset(parent as Nodes);
  if (source === undefined || from === null || to === null) return null;
  const scope = source.slice(from, to);
  const at = scope.indexOf(literal);
  if (at === -1 || scope.indexOf(literal, at + 1) !== -1) return null;
  return [from + at, from + at + literal.length];
}

function buildLink(
  grammar: TokenGrammar,
  type: string,
  id: string,
  range: [number, number] | null,
  splittable: boolean,
): TokenLink {
  const token: ChatToken = { kind: grammar.kind, type, id, range, splittable: splittable && range !== null };
  return {
    type: 'link',
    url: tokenUrl(grammar.kind, type, id),
    children: [{ type: 'text', value: grammar.literal(type, id) }],
    data: { chatToken: token },
  };
}

function rangeOf(node: Nodes): [number, number] | null {
  const start = startOffset(node);
  const end = endOffset(node);
  return start === null || end === null ? null : [start, end];
}

/** Replace a WHOLE node that is exactly one token (a code span, a link's text). */
function wholeNodeToken(node: Nodes, grammar: TokenGrammar, splittable: boolean): TokenLink | null {
  if (node.type === 'inlineCode') {
    const hit = grammar.exact(node.value);
    return hit ? buildLink(grammar, hit.type, hit.id, rangeOf(node), splittable) : null;
  }
  if (node.type === 'link' && isTokenLink(node)) {
    // A link the model wrote with the scheme itself (`[Pricing](card://page:pricing)`): already a token, so it is
    // recorded like one (the pre-scans read it) and keeps its href.
    if (node.data?.chatToken) return null;
    const hit = parseTokenHref(grammar.kind, node.url);
    return hit ? buildLink(grammar, hit.type, hit.id, rangeOf(node), splittable) : null;
  }
  // A link (or a reference link: `[card://webinar:42]` plus a `[card://webinar:42]: <url>` definition) whose whole
  // text is one token.
  if ((node.type === 'link' && !isAutolinkLiteral(node)) || node.type === 'linkReference') {
    const hit = grammar.exact(toString(node));
    return hit ? buildLink(grammar, hit.type, hit.id, rangeOf(node), splittable) : null;
  }
  return null;
}

/**
 * Match the tokens in one parent's phrasing children. Runs of transparent siblings are joined into one string; a token
 * is replaced when it sits inside one text child or runs across siblings with both of its ends either inside a text
 * child or on a child's edge. A token lying wholly inside a wrapper (`**@script:x**`) belongs to that wrapper and was
 * already replaced when the walk visited it.
 */
function replaceInRuns(parent: Parent, grammar: TokenGrammar, source: string | undefined, splittable: boolean): void {
  const children = parent.children as PhrasingContent[];
  let runStart = 0;
  const runs: Array<[number, number]> = [];
  for (let i = 0; i <= children.length; i++) {
    if (i === children.length || !isTransparent(children[i])) {
      if (i > runStart) runs.push([runStart, i]);
      runStart = i + 1;
    }
  }

  // Right to left, so the indices of runs still to apply stay valid. Within a run every token is read against the
  // ORIGINAL children first (ranges included), then the run is rebuilt left to right in one splice.
  for (const [from, to] of runs.reverse()) {
    const run = children.slice(from, to);
    const texts = run.map(c => toString(c));
    const offsets: number[] = [];
    let total = 0;
    for (const t of texts) {
      offsets.push(total);
      total += t.length;
    }
    const joined = texts.join('');
    const childAt = (pos: number) => {
      for (let k = texts.length - 1; k >= 0; k--) if (offsets[k] <= pos && texts[k].length > 0) return k;
      return 0;
    };

    const accepted: Array<{ a: number; b: number; startIn: number; endIn: number; link: TokenLink }> = [];
    for (const tok of grammar.find(joined)) {
      const a = childAt(tok.start);
      const b = childAt(tok.end - 1);
      const startIn = tok.start - offsets[a];
      const endIn = tok.end - offsets[b];
      if (a === b && run[a].type !== 'text') continue; // the wrapper owns it
      if (startIn > 0 && run[a].type !== 'text') continue; // starts mid-wrapper: no clean cut
      if (endIn < texts[b].length && run[b].type !== 'text') continue; // ends mid-wrapper
      const startSrc = sourceOffsetIn(run[a], texts[a].length, startIn);
      const endSrc = sourceOffsetIn(run[b], texts[b].length, endIn);
      const range: [number, number] | null =
        startSrc !== null && endSrc !== null
          ? [startSrc, endSrc]
          : uniqueSourceRange(parent, joined.slice(tok.start, tok.end), source);
      accepted.push({ a, b, startIn, endIn, link: buildLink(grammar, tok.type, tok.id, range, splittable) });
    }
    if (accepted.length === 0) continue;

    const rebuilt: PhrasingContent[] = [];
    let ci = 0; // next run child to emit
    let offIn = 0; // how much of run[ci] is already consumed (only ever a text child)
    const emitUpTo = (k: number) => {
      for (; ci < k; ci++, offIn = 0) {
        rebuilt.push(offIn > 0 ? ({ type: 'text', value: (run[ci] as Text).value.slice(offIn) } as Text) : run[ci]);
      }
    };
    for (const { a, b, startIn, endIn, link } of accepted) {
      emitUpTo(a);
      if (startIn > offIn) rebuilt.push({ type: 'text', value: (run[a] as Text).value.slice(offIn, startIn) } as Text);
      rebuilt.push(link);
      ci = b;
      offIn = endIn;
      if (offIn >= texts[b].length) {
        ci = b + 1;
        offIn = 0;
      }
    }
    emitUpTo(run.length);
    children.splice(from, to - from, ...rebuilt);
  }
}

/** Containers the raw text can be cut inside: a split leaves two well-formed pieces of markdown. */
const SPLITTABLE_CONTAINERS = new Set(['root', 'paragraph', 'list', 'listItem']);

function walk(parent: Parent, grammar: TokenGrammar, source: string | undefined, splittable: boolean): void {
  const children = parent.children as Nodes[];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const whole = wholeNodeToken(child, grammar, splittable);
    if (whole) {
      children[i] = whole;
      continue;
    }
    // Never into a link (no anchor inside an anchor), a token we made, a code block or raw HTML.
    if (child.type === 'link' || child.type === 'linkReference' || child.type === 'code' || child.type === 'html') {
      continue;
    }
    if ('children' in child)
      walk(child as Parent, grammar, source, splittable && SPLITTABLE_CONTAINERS.has(child.type));
  }
  replaceInRuns(parent, grammar, source, splittable);
}

function tokenPlugin(grammar: TokenGrammar): Plugin<[], Root> {
  return () => (tree: Root, file?: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : undefined;
    walk(tree, grammar, source, true);
  };
}

/** Remark plugin: `@<marker>:<id>` mentions become `mention://` links, which the chat's `<a>` override hands to the
 *  host's `renderMention`. */
export const remarkMentionChips = tokenPlugin(MENTION_GRAMMAR);

/** Remark plugin: `[card://<type>:<id>]` markers become `card://` links, which the chat's `<a>` override hands to the
 *  host's `renderEntityCard`. A remark plugin, not a regex on the raw source, so the formatting around a marker
 *  survives and the marker is gone before the HTML pass. */
export const remarkCardLinks = tokenPlugin(CARD_GRAMMAR);

/**
 * Every token the chat body draws for `markdown`, in document order, with the source range each replaced. Runs the
 * same parser (CommonMark + GFM) and the same walker as the body, so a pre-scan reads exactly the tokens on screen.
 */
export function scanChatTokens(markdown: string, kinds: readonly ChatTokenKind[]): ChatToken[] {
  if (!markdown) return [];
  const wantsMention = kinds.includes('mention') && markdown.includes('@');
  const wantsCard = kinds.includes('card') && markdown.includes('card://');
  if (!wantsMention && !wantsCard) return [];
  const plugins: PluggableList = [remarkParse, remarkGfm];
  if (wantsCard) plugins.push(remarkCardLinks);
  if (wantsMention) plugins.push(remarkMentionChips);
  const processor = unified().use(plugins);
  const tree = processor.runSync(processor.parse(markdown), markdown) as Root;
  const out: ChatToken[] = [];
  const collect = (node: Nodes) => {
    if (isTokenLink(node)) {
      const token = node.data?.chatToken;
      if (token) out.push(token);
      return;
    }
    if ('children' in node) for (const c of node.children as Nodes[]) collect(c);
  };
  collect(tree);
  return out;
}
