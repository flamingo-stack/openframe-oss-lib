/**
 * The loading standard over the lib's own source, through THE rule engine (`src/loading-standard/engine.mjs`, the
 * same module every host's gate imports from its installed copy). It replaces the line-based `one-switch.test.ts` and
 * `skeleton-counts.test.ts`: every rule now reads components through the TypeScript AST (aliases, `as` renames,
 * `createElement`, multi-line conditions), and the lib's own exemptions (the deprecated whole-view re-exports, the
 * loading primitives, the loaders themselves) are declared once, in the engine's `CONFIGS.lib`.
 *
 * Three checks: every rule fails its failing example and passes its passing one (`rule-examples.mjs`, shared with the
 * hosts' gate tests); every shape the round-5 reviewers proved a line-based gate missed fails; and the lib's `src/`
 * breaks no rule.
 */
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeProject,
  CONFIGS,
  formatFindings,
  pageCodeFindings,
  Project,
  RULES,
} from '../loading-standard/engine.mjs';
import { RULE_EXAMPLES } from '../loading-standard/rule-examples.mjs';
import { REVIEW_FIXTURES } from './fixtures/loading-standard-review.mjs';

const SRC = join(__dirname, '..');
const VIRTUAL = '/virtual/src';

type Finding = { rule: string; file: string; line: number; message: string };

/** Every finding of a virtual source tree (paths relative to its `src/`). */
function findingsOf(files: Record<string, string>): Finding[] {
  const sources = new Map(Object.entries(files).map(([rel, text]) => [`${VIRTUAL}/${rel}`, text]));
  const project = new Project({ trees: [{ dir: VIRTUAL, report: true, sources }] });
  const findings: Finding[] = analyzeProject(project);
  for (const path of sources.keys()) {
    if (relative(VIRTUAL, path).startsWith('app/'))
      findings.push(...pageCodeFindings(project, path, relative(VIRTUAL, path)));
  }
  return findings;
}

describe('loading-standard engine: one failing and one passing example per rule', () => {
  it('has an example for every rule', () => {
    expect(RULE_EXAMPLES.map(e => e.rule).sort()).toEqual([...Object.keys(RULES), 'PAGE_CODE'].sort());
  });

  it.each(RULE_EXAMPLES.map(example => [example.rule, example] as const))('%s', (rule, example) => {
    expect(findingsOf(example.fail).map(f => f.rule)).toContain(rule);
    expect(findingsOf(example.pass).filter(f => f.rule === rule)).toEqual([]);
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

  it('honours the opt-out markers', () => {
    const findings = findingsOf({
      'components/x.tsx':
        'export function X() {\n  // loading-standard-ok: an action in progress\n  return <div className="animate-spin" />;\n}\nexport function Y() {\n  // full-page-ok: fixed by design\n  return <Table skeletonRows={3} />;\n}\n',
    });
    expect(findings).toEqual([]);
  });
});

describe('the loading standard over the lib', () => {
  it('no component in src/ breaks a rule', () => {
    const project = new Project({ trees: [{ dir: SRC, report: true }] });
    const findings = analyzeProject(project, CONFIGS.lib);
    expect(formatFindings(findings)).toEqual([]);
  });
});
