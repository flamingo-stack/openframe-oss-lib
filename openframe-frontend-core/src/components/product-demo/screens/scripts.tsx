'use client';

import { useMemo } from 'react';
import {
  EXECUTION_COLUMNS,
  ScriptExecutionResult,
  ScriptExecutionsTable,
  type ScriptExecutionTableRow,
  ScriptShellBadge,
  type ScriptsTableColumnLayout,
} from '../../features/scripts';
import { TimerIcon } from '../../icons-v2-generated/date-and-time/timer-icon';
import { TruncateText } from '../../ui/truncate-text';
import { useProductDemoCast } from '../cast';
import { buildScriptsFixture, type DemoScript } from '../fixtures/scripts';
import type { ProductScreenViewProps } from '../types';

/**
 * The picture has nowhere to open a run and no row menu, and the Result
 * column would repeat the output opened under its row.
 */
const WIDE_HIDDEN_COLUMNS = ['result', 'open'];

/**
 * A card's width hides the device column (the product's page drops it below
 * `lg`), and the device is what the narrow picture is about: here it takes
 * the room, with the status beside it.
 */
const COMPACT_COLUMNS: readonly ScriptsTableColumnLayout[] = [
  { ...EXECUTION_COLUMNS.machineId, width: 'flex-1 min-w-0', hideAt: undefined },
  EXECUTION_COLUMNS.status,
];
const COMPACT_ROWS = 4;

type TokenKind = 'comment' | 'keyword' | 'string' | 'variable' | 'command' | 'parameter' | 'number' | 'plain';

/**
 * PowerShell token colours: the product editor's `ods-dark` highlight style
 * (`script-editor-view.tsx`) in ODS tokens. Keywords yellow, strings and
 * variables cyan, commands green, numbers amber, parameters grey, comments
 * muted.
 */
const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: 'italic text-ods-text-tertiary',
  keyword: 'text-ods-warning',
  string: 'text-ods-flamingo-cyan',
  variable: 'text-ods-flamingo-cyan',
  command: 'text-ods-success',
  parameter: 'text-ods-text-secondary',
  number: 'text-ods-open-yellow',
  plain: 'text-ods-text-primary',
};

/** One group per kind, in {@link TOKEN_KINDS} order; a comment or a string swallows what it contains. */
const TOKEN_PATTERN =
  /(#.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$[\w:]+)|\b(foreach|in|if|else|exit|return|param)\b|\b([A-Z][a-z]+-[A-Z][A-Za-z]+)\b|(-[A-Za-z]+)\b|\b(\d+(?:GB|MB|KB)?)\b/g;
const TOKEN_KINDS: readonly TokenKind[] = [
  'comment',
  'string',
  'variable',
  'keyword',
  'command',
  'parameter',
  'number',
];

interface Token {
  text: string;
  kind: TokenKind;
}

/** One line of PowerShell as coloured runs. Only the picture's own script is read, so the rules are few. */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ text: line.slice(last, start), kind: 'plain' });
    const group = match.slice(1).findIndex(Boolean);
    tokens.push({ text: match[0], kind: TOKEN_KINDS[group] ?? 'plain' });
    last = start + match[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), kind: 'plain' });
  return tokens;
}

/**
 * The script as the product's details page shows it: its name and shell over
 * the editor's read-only view. The product's editor is CodeMirror, which the
 * library does not carry, so this draws the editor's geometry (a 46px number
 * gutter, the code 32px past it, 22px rows of 14px mono) in its colours. The
 * header adds the schedule that runs the script and who wrote and approved
 * it: the two things the conversation beside the picture settled.
 */
function ScriptCodePicture({ script }: { script: DemoScript }) {
  // Keyed by line number: the script never changes under the picture.
  const lines = useMemo(
    () => script.code.split('\n').map((line, index) => ({ number: index + 1, tokens: tokenize(line) })),
    [script.code],
  );
  const { schedule, provenance } = script;
  return (
    <section
      aria-label={script.name}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-[8px] border border-ods-border bg-ods-card"
    >
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-b border-ods-border p-[var(--spacing-system-m)]">
        <div className="flex min-w-0 items-center justify-between gap-[var(--spacing-system-m)]">
          <TruncateText variant="h4">{script.name}</TruncateText>
          <span className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)] text-ods-text-primary text-h6">
            <TimerIcon className="size-4 text-ods-text-secondary" />
            {`${schedule.repeat} ${schedule.time} · ${schedule.deviceCount} devices`}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-[var(--spacing-system-m)]">
          <TruncateText variant="h6" tone="secondary">
            {`Written by ${provenance.author} · approved by ${provenance.approver}`}
          </TruncateText>
          <ScriptShellBadge
            value={script.shellType}
            className="shrink-0 text-ods-text-secondary text-h6"
            iconClassName="size-4"
          />
        </div>
      </div>
      <pre className="m-0 min-h-0 flex-1 overflow-hidden bg-ods-bg py-3 font-mono text-[14px] leading-[22px]">
        {lines.map(line => (
          <div key={line.number} className="flex">
            <span className="w-[46px] shrink-0 select-none pr-[4px] text-right text-ods-text-tertiary">
              {line.number}
            </span>
            <code className="whitespace-pre pl-[32px]">
              {line.tokens.map((token, at) => (
                <span key={`${at}-${token.text}`} className={TOKEN_CLASS[token.kind]}>
                  {token.text}
                </span>
              ))}
            </code>
          </div>
        ))}
      </pre>
    </section>
  );
}

/**
 * Where the page's Mingo conversation leaves off: the script it wrote, on the
 * left, and the first night its schedule ran, on the right, as the product's
 * Execution History (a run still going, one failed, one finished with its
 * output open under it: what it cleaned and what it freed). The schedule form
 * and the library are the conversation's part, so the picture leaves them
 * out. The narrow rendering is the run alone: which devices, and how each went.
 */
export default function ScriptsScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildScriptsFixture(cast), [cast]);

  if (compact) {
    return (
      // Four runs of the card's row height fill the frame; the padding is what is left round them.
      <div className="h-full overflow-hidden bg-ods-bg p-[var(--spacing-system-xsf)]">
        <ScriptExecutionsTable
          rows={fixture.executions.slice(0, COMPACT_ROWS)}
          columns={COMPACT_COLUMNS}
          showHeader={false}
          compact
        />
      </div>
    );
  }

  const renderOutput = (row: ScriptExecutionTableRow) =>
    row.id === fixture.openExecutionId ? <ScriptExecutionResult result={row.result} empty="—" /> : null;

  return (
    // The frame's tighter padding and no header row: the output opened under a run needs the height.
    <div className="flex h-full gap-[var(--spacing-system-m)] overflow-hidden bg-ods-bg p-[var(--spacing-system-m)]">
      <div className="w-[39%] shrink-0">
        <ScriptCodePicture script={fixture.script} />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <ScriptExecutionsTable
          rows={fixture.executions}
          hideColumns={WIDE_HIDDEN_COLUMNS}
          renderSubRow={renderOutput}
          showHeader={false}
          compact
        />
      </div>
    </div>
  );
}
