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
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeProject, CONFIGS, formatFindings, Project, RULES } from '../loading-standard/engine.mjs';
import { RULE_EXAMPLES } from '../loading-standard/rule-examples.mjs';
import { REVIEW_FIXTURES, REVIEW_FIXTURES_R6 } from './fixtures/loading-standard-review.mjs';

const SRC = join(__dirname, '..');
const VIRTUAL = '/virtual/src';

type Finding = { rule: string; file: string; line: number; message: string };

/** Every finding of a virtual source tree (paths relative to its `src/`), under the frontend config (page code too). */
function findingsOf(files: Record<string, string>): Finding[] {
  const sources = new Map(Object.entries(files).map(([rel, text]) => [`${VIRTUAL}/${rel}`, text]));
  const project = new Project({ trees: [{ dir: VIRTUAL, report: true, sources }] });
  return analyzeProject(project, CONFIGS.frontend);
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

describe('the loading standard over the lib', () => {
  // Parses every file of src/: several seconds on a CI runner, so it has its own timeout.
  it('no component in src/ breaks a rule', { timeout: WHOLE_SRC_SCAN_TIMEOUT_MS }, () => {
    const project = new Project({ trees: [{ dir: SRC, report: true }] });
    const findings = analyzeProject(project, CONFIGS.lib);
    expect(formatFindings(findings)).toEqual([]);
  });
});
