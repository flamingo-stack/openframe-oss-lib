/**
 * The loading standard over the lib's own source, through THE rule engine (`src/loading-standard/engine.mjs`, the
 * module every host's gate imports from its installed copy; its header states every rule). The lib's exemptions are
 * declared once, in the engine's `CONFIGS.lib`.
 *
 * Four checks: every rule fails its failing example and passes its passing one (`rule-examples.mjs`, shared with the
 * hosts' gate tests); every shape the round-5 and round-6 reviewers proved a gate missed fails
 * (`fixtures/loading-standard-review.mjs`); an opt-out lifts only the rule it names on its line; and the lib's `src/`
 * breaks no rule.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeProject,
  CONFIGS,
  formatFindings,
  loadTypeScript,
  Project,
  RULES,
} from '../loading-standard/engine.mjs';
import { RULE_EXAMPLES } from '../loading-standard/rule-examples.mjs';
import { REVIEW_FIXTURES, REVIEW_FIXTURES_R6 } from './fixtures/loading-standard-review.mjs';

const SRC = join(__dirname, '..');
const VIRTUAL = '/virtual/src';

type Finding = { rule: string; file: string; line: number; message: string };

/** Every finding of a virtual source tree (paths relative to its `src/`), under the frontend config (page code too). */
function findingsOf(
  files: Record<string, string>,
  config: Parameters<typeof analyzeProject>[1] = CONFIGS.frontend,
): Finding[] {
  const sources = new Map(Object.entries(files).map(([rel, text]) => [`${VIRTUAL}/${rel}`, text]));
  const project = new Project({ trees: [{ dir: VIRTUAL, report: true, sources }] });
  return analyzeProject(project, config);
}

/** The whole-src scan's limit: the parse took over 5 s (vitest's default) on a GitHub runner. */
const WHOLE_SRC_SCAN_TIMEOUT_MS = 120_000;

describe('loading-standard engine: one failing and one passing example per rule', () => {
  it('has an example for every rule', () => {
    expect([...new Set(RULE_EXAMPLES.map(e => e.rule))].sort()).toEqual(Object.keys(RULES).sort());
  });

  it.each(
    RULE_EXAMPLES.map(example => [example.name ? `${example.rule}: ${example.name}` : example.rule, example] as const),
  )('%s', (_, example) => {
    const { rule } = example;
    expect(findingsOf(example.fail).map(f => f.rule)).toContain(rule);
    expect(findingsOf(example.pass).filter(f => f.rule === rule)).toEqual([]);
  });
});

describe('loading-standard engine: skeleton primitives', () => {
  /** A component that switches on the scope and draws `bars` as its loading form. */
  const switching = (bars: string) => ({
    'components/title/title.tsx': `export function Title({ title }: { title: string }) {
  return useLoadingScope() ? ${bars} : <h2>{title}</h2>;
}
`,
  });

  it('takes the per-breakpoint text bars as a primitive (a wrapping title draws them on its own switch)', () => {
    const findings = findingsOf(switching('<TextLinesByBreakpointSkeleton lines={{ phone: 2, md: 1, lg: 1 }} />'));
    expect(findings.filter(f => f.rule === 'NO_SCOPE_SWITCH')).toEqual([]);
  });

  it('still refuses a skeleton with no component of its own that is not a primitive', () => {
    // Declared in a module of its own with no `HeadingBars` beside it: the shape the per-breakpoint bars have.
    const findings = findingsOf({
      'components/bars/bars.tsx': 'export function HeadingBarsSkeleton() { return <i />; }\n',
      'components/title/title.tsx': `import { HeadingBarsSkeleton } from '../bars/bars';
${switching('<HeadingBarsSkeleton />')['components/title/title.tsx']}`,
    });
    expect(findings.map(f => f.rule)).toContain('NO_SCOPE_SWITCH');
  });
});

describe('loading-standard engine: the round-5 review fixtures', () => {
  it('fails every reviewer fixture, at every hole they proved', () => {
    const found = [...new Set(findingsOf(REVIEW_FIXTURES).map(f => `${f.file}:${f.line} ${f.rule}`))].sort();
    expect(found).toEqual(
      [
        'components/parent/f0-sanity.tsx:2 ONE_SWITCH',
        'components/parent/f0-sanity.tsx:3 SUSPENSE_FALLBACK',
        'components/parent/f1-alias.tsx:2 ONE_SWITCH',
        'components/parent/f10-wholeview.tsx:1 WHOLE_VIEW_SKELETON',
        'components/parent/f10-wholeview.tsx:2 WHOLE_VIEW_SKELETON',
        'components/parent/f10-wholeview.tsx:3 FOLD_PROP',
        'components/parent/f11-word.tsx:7 ITEM_MARK',
        'components/parent/f11-word.tsx:8 ITEM_MARK',
        'components/parent/f12-multiline-null.tsx:12 NOTHING_WHILE_LOADING',
        'components/parent/f12-multiline-null.tsx:2 NOTHING_WHILE_LOADING',
        'components/parent/f12-multiline-null.tsx:8 NOTHING_WHILE_LOADING',
        'components/parent/f13-cap.tsx:11 HIDDEN_ITEMS',
        'components/parent/f13-cap.tsx:13 ITEM_MARK',
        'components/parent/f13-cap.tsx:8 COUNT_CAP',
        'components/parent/f2-var.tsx:3 ONE_SWITCH',
        'components/parent/f3-createel.tsx:2 ONE_SWITCH',
        'components/parent/f4-propswitch.tsx:2 PROP_ONLY_SWITCH',
        'components/parent/f4-propswitch.tsx:6 PROP_ONLY_SWITCH',
        'components/parent/f5-propswitch-sibling.tsx:3 PROP_ONLY_SWITCH',
        'components/parent/f6-spinner.tsx:11 NOTHING_WHILE_LOADING',
        'components/parent/f6-spinner.tsx:12 NOTHING_WHILE_LOADING',
        'components/parent/f6-spinner.tsx:13 OWN_PULSE',
        'components/parent/f6-spinner.tsx:5 SPINNER',
        'components/parent/f7-suspense.tsx:4 SUSPENSE_FALLBACK',
        'components/parent/f7-suspense.tsx:7 SUSPENSE_FALLBACK',
        'components/parent/f8-counts.tsx:10 COUNT_CAP',
        'components/parent/f8-counts.tsx:13 COUNT_CAP',
        'components/parent/f8-counts.tsx:13 HIDDEN_ITEMS',
        'components/parent/f8-counts.tsx:15 ITEM_MARK',
        'components/parent/f8-counts.tsx:8 ITEM_MARK',
        'components/parent/f8-counts.tsx:8 TYPED_COUNT',
        'components/parent/f9-marks.tsx:10 OPTIONAL_MARK',
        'components/parent/f9-marks.tsx:11 OPTIONAL_MARK',
        'components/parent/f9-marks.tsx:8 ITEM_MARK',
        'components/parent/f9-marks.tsx:9 ITEM_MARK',
      ].sort(),
    );
  });
});

describe('loading-standard engine: the round-6 review fixtures', () => {
  const found = findingsOf(REVIEW_FIXTURES_R6);
  const helpers = new Set([
    'components/r6/b20-comment-mark.tsx',
    'components/r6/b31-family.tsx',
    'components/r6/chart.tsx',
  ]);

  it.each(Object.keys(REVIEW_FIXTURES_R6).filter(file => !helpers.has(file)))('fails %s', file => {
    expect(found.filter(f => f.file === file)).not.toEqual([]);
  });

  it('reports nothing on the helpers', () => {
    expect(found.filter(f => helpers.has(f.file))).toEqual([]);
  });
});

describe('loading-standard engine: opt-outs', () => {
  it('lifts only the rule it names, on its own line or the line under it', () => {
    const findings = findingsOf({
      'components/x.tsx':
        'export function X() {\n  // loading-standard-ok(SPINNER): an action in progress\n  return <div className="animate-spin" />;\n}\nexport function Y() {\n  return <div className="animate-spin animate-pulse" />; // loading-standard-ok(OWN_PULSE): a live dot\n}\n',
    });
    expect(findings.map(f => `${f.line} ${f.rule}`)).toEqual(['6 SPINNER']);
  });

  it('fails a marker with no rule, a reason or anything to lift, and lifts nothing two lines down', () => {
    const findings = findingsOf({
      'components/x.tsx':
        'export function X() {\n  // loading-standard-ok(SPINNER):\n  // loading-standard-ok(SPINNER): too far\n  const a = 1;\n  return <div className="animate-spin" />;\n}\n',
    });
    expect(findings.map(f => `${f.line} ${f.rule}`).sort()).toEqual(['2 OPT_OUT', '3 OPT_OUT', '5 SPINNER']);
  });
});

describe('loading-standard engine: the hub config and a host boundary', () => {
  const page = (root: string) => ({
    'app/x/page.tsx': `export default function Page() { return ${root}; }\n`,
  });
  const boundaryRules = (root: string) =>
    findingsOf(page(root), CONFIGS.hub)
      .filter(f => f.rule === 'PAGE_BOUNDARY')
      .map(f => f.rule);

  it('flags a whole-page StreamedSection, and one told cached={false}', () => {
    expect(boundaryRules('<StreamedSection read={r} render={d} placeholder={p} />')).toEqual(['PAGE_BOUNDARY']);
    expect(boundaryRules('<StreamedSection cached={false} read={r} render={d} placeholder={p} />')).toEqual([
      'PAGE_BOUNDARY',
    ]);
  });

  it('passes a cached StreamedSection, bare or through a value', () => {
    expect(boundaryRules('<StreamedSection cached read={r} render={d} placeholder={p} />')).toEqual([]);
    expect(boundaryRules('<StreamedSection cached={isCached} read={r} render={d} placeholder={p} />')).toEqual([]);
  });

  it('runs only the boundary rules on the hub', () => {
    expect(CONFIGS.hub.rules.sort()).toEqual(['HAND_PAIR', 'PAGE_BOUNDARY', 'RAW_SUSPENSE', 'SUSPENSE_FALLBACK']);
  });
});

describe('loading-standard engine: the compiler it reads with', () => {
  /** A folder whose `typescript` is a stub with no compiler API (a TypeScript 7 nested beside the engine). */
  function stubFolder(): string {
    const dir = mkdtempSync(join(tmpdir(), 'ts-stub-'));
    mkdirSync(join(dir, 'node_modules', 'typescript'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', 'typescript', 'package.json'),
      '{"name":"typescript","version":"7.0.2","main":"index.js"}',
    );
    writeFileSync(join(dir, 'node_modules', 'typescript', 'index.js'), 'module.exports = { version: "7.0.2" };');
    writeFileSync(join(dir, 'package.json'), '{"name":"stub"}');
    return dir;
  }

  it('skips a TypeScript with no compiler API and takes the next place', () => {
    const stub = join(stubFolder(), 'package.json');
    const ts = loadTypeScript([stub, join(SRC, '..', 'package.json')]);
    expect(typeof ts.createSourceFile).toBe('function');
  });

  it('says what it tried when no place has a compiler API', () => {
    const stub = join(stubFolder(), 'package.json');
    expect(() => loadTypeScript([stub])).toThrow(/typescript 7\.0\.2 has no compiler API/);
  });
});

describe('the loading standard over the lib', () => {
  // Parses every file of src/: several seconds on a CI runner, so it has its own timeout.
  it('no component in src/ breaks a rule', { timeout: WHOLE_SRC_SCAN_TIMEOUT_MS }, () => {
    const project = new Project({ trees: [{ dir: SRC, report: true }] });
    const findings = analyzeProject(project, CONFIGS.lib);
    expect(formatFindings(findings)).toEqual([]);
  });
});
