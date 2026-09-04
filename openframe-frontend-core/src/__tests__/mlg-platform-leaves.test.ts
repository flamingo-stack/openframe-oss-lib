import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PLATFORM_DOMAINS } from '../platform-domains';
import type { PlatformName } from '../types/platform';
import { clamp, pick, NO_CLIENT_CACHE } from '../utils/common';
import { csvEscape, toCsv, CSV_CONTENT_TYPE } from '../utils/csv';
import { nameInitials, personInitials, singleInitial } from '../utils/format';
import { ODS_SPACING_TOKENS, TAILWIND_STEP_TO_ODS_TOKEN } from '../utils/ods-spacing';
import {
  ODS_STEM_CLASSES,
  ODS_STEM_TOKENS,
  PLATFORM_BRAND,
  PLATFORM_SURFACE,
  PLATFORM_THEME,
  getPlatformAccentColor,
  getPlatformBrandClasses,
  getPlatformSecondaryColor,
  getPlatformShortName,
  platformColors,
  platformHexColors,
  platformShortNames,
  platformDisplayNames,
} from '../utils/platform-identity';
import {
  PAGE_PARAM_LIMITS,
  clampPageToTotal,
  createSearchParams,
  defineParamSchema,
  fromKeys,
  pageCount,
  parseSchemaParams,
  positiveInt,
  serializeSchemaParams,
  shouldIncludeInUrl,
  withQuery,
} from '../utils/search-params';
import {
  SOCIAL_PLATFORM_ALT_HOSTS,
  classifySocialHost,
  hostMatches,
  socialPlatformHosts,
  normalizeSocialPlatform,
  pickSocialLink,
} from '../utils/social-platforms';

const CSS = readFileSync(join(__dirname, '../styles/ods-colors.css'), 'utf8');
const SPACING_CSS = readFileSync(join(__dirname, '../styles/ods-responsive-tokens.css'), 'utf8');
const PLATFORMS = Object.keys(PLATFORM_BRAND) as PlatformName[];

describe('platform identity', () => {
  it('carries mlg end to end', () => {
    expect(PLATFORM_BRAND.mlg).toEqual({ accentStem: 'flamingo-pink', secondaryStem: 'flamingo-cyan' });
    expect(getPlatformShortName('mlg')).toBe('MLG');
    expect(getPlatformAccentColor('mlg')).toBe('var(--ods-flamingo-pink-base)');
    expect(getPlatformSecondaryColor('mlg')).toBe('var(--ods-flamingo-cyan-base)');
    expect(PLATFORM_DOMAINS.find(e => e.key === 'mlg')?.defaultUrl).toBe('https://www.mlg.soccer');
  });

  it('lists ONLY genuine overrides in platformShortNames', () => {
    // a row that equals the display name is redundant and must not exist
    for (const [platform, short] of Object.entries(platformShortNames)) {
      expect(short).not.toBe(platformDisplayNames[platform as keyof typeof platformDisplayNames]);
    }
    // every platform without an override falls back to its display name
    expect(getPlatformShortName('openmsp')).toBe('OpenMSP');
    expect(getPlatformShortName('unknown-platform')).toBe('unknown-platform');
  });

  it('derives every brand class from the stem table', () => {
    for (const platform of PLATFORMS) {
      const brand = PLATFORM_BRAND[platform];
      const classes = getPlatformBrandClasses(platform);
      expect(classes.accentText).toBe(ODS_STEM_CLASSES[brand.accentStem].text);
      expect(classes.accentBg).toBe(ODS_STEM_CLASSES[brand.accentStem].bg);
      expect(classes.secondaryText).toBe(ODS_STEM_CLASSES[brand.secondaryStem].text);
      expect(platformColors[platform]).toBe(classes.accentBg);
    }
  });

  it('every stem token and the surface tokens exist in the CSS', () => {
    for (const token of Object.values(ODS_STEM_TOKENS)) {
      expect(CSS).toContain(`--ods-${token}:`);
    }
    expect(CSS).toContain(`--ods-${PLATFORM_SURFACE.background}:`);
    expect(CSS).toContain(`--ods-${PLATFORM_SURFACE.text}:`);
    expect(PLATFORM_THEME).toBe('dark');
  });

  it("every platform's CSS block matches the brand record", () => {
    for (const platform of PLATFORMS) {
      if (platform === 'universal') continue; // no [data-app-type] block
      const block = CSS.split(`[data-app-type='${platform}']`)[1]?.split('}')[0];
      expect(block, `missing CSS block for ${platform}`).toBeTruthy();
      const accent = `var(--ods-${ODS_STEM_TOKENS[PLATFORM_BRAND[platform].accentStem]})`;
      const link = `var(--ods-${ODS_STEM_TOKENS[PLATFORM_BRAND[platform].secondaryStem]})`;
      expect(block).toContain(`--color-accent-primary: ${accent};`);
      expect(block).toContain(`--color-link: ${link};`);
    }
  });

  it('platformHexColors mirrors each accent token', () => {
    for (const platform of PLATFORMS) {
      const token = ODS_STEM_TOKENS[PLATFORM_BRAND[platform].accentStem];
      const declared = CSS.match(new RegExp(`--ods-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
      expect(declared, `no hex for --ods-${token}`).toBeTruthy();
      expect(platformHexColors[platform].toLowerCase()).toBe(String(declared).toLowerCase());
    }
  });
});

describe('initials policies', () => {
  it('personInitials takes first + last, empty when unnamed', () => {
    expect(personInitials('John Michael Doe')).toBe('JD');
    expect(personInitials('Cher')).toBe('C');
    expect(personInitials(null)).toBe('');
    expect(personInitials('   ')).toBe('');
  });
  it('singleInitial takes one letter with a ? fallback', () => {
    expect(singleInitial('OpenAI')).toBe('O');
    expect(singleInitial(undefined)).toBe('?');
  });
  it('nameInitials keeps its two-leading-letters default', () => {
    expect(nameInitials('John Michael Doe')).toBe('JM');
    expect(nameInitials('', 'E')).toBe('E');
  });
});

describe('common leaf', () => {
  it('clamps and picks', () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-5, 1, 3)).toBe(1);
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    expect(pick({ a: undefined } as { a: number | undefined }, ['a'])).toEqual({ a: undefined });
  });
  it('states the no-client-cache rule once', () => {
    expect(NO_CLIENT_CACHE).toEqual({ staleTime: 0 });
  });
});

describe('csv leaf', () => {
  it('quotes per RFC 4180', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape(null)).toBe('');
  });
  it('neutralizes formulas but not numbers', () => {
    expect(csvEscape('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvEscape('@sum')).toBe("'@sum");
    expect(csvEscape('-12')).toBe('-12');
    expect(csvEscape('-12.5e3')).toBe('-12.5e3');
    expect(csvEscape('-not-a-number')).toBe("'-not-a-number");
  });
  it('serializes rows', () => {
    const csv = toCsv(
      [{ n: 'a', v: 1 }],
      [
        { header: 'Name', value: r => r.n },
        { header: 'Value', value: r => r.v },
      ],
    );
    expect(csv).toBe('Name,Value\na,1');
    expect(CSV_CONTENT_TYPE).toContain('text/csv');
  });
});

describe('social platforms leaf', () => {
  // Rows as `social_platforms` actually holds them — the table is the
  // vocabulary, so every test here feeds it in rather than trusting a list
  // compiled into the module.
  const SOCIAL_ROWS = [
    { name: 'website', baseUrl: '', urlPattern: '' },
    { name: 'linkedin', baseUrl: 'https://linkedin.com/in/', urlPattern: 'https://linkedin.com/in/{username}' },
    { name: 'twitter', baseUrl: 'https://twitter.com/', urlPattern: 'https://twitter.com/{username}' },
    { name: 'github', baseUrl: 'https://github.com/', urlPattern: 'https://github.com/{username}' },
    { name: 'youtube', baseUrl: 'https://youtube.com/@', urlPattern: 'https://youtube.com/@{username}' },
  ];

  it('resolves a known spelling and PASSES THROUGH an unknown name', () => {
    expect(normalizeSocialPlatform('X')).toBe('twitter');
    expect(normalizeSocialPlatform('GENERIC')).toBe('website');
    // Not a gate: this module is not the authority on which platforms exist,
    // so a name it has never heard of survives for the DB to judge.
    expect(normalizeSocialPlatform('mastodon')).toBe('mastodon');
    expect(normalizeSocialPlatform('  ')).toBeNull();
    expect(normalizeSocialPlatform(null)).toBeNull();
  });
  it('matches hosts and subdomains only', () => {
    expect(hostMatches('www.github.com', 'github.com')).toBe(true);
    expect(hostMatches('gist.github.com', 'github.com')).toBe(true);
    expect(hostMatches('notgithub.com', 'github.com')).toBe(false);
  });
  it('derives a platform host from its row, not from a table in this file', () => {
    expect(socialPlatformHosts({ name: 'github', urlPattern: 'https://github.com/{username}' })).toEqual([
      'github.com',
    ]);
    // A row nobody has hardcoded still classifies, purely from its pattern.
    expect(socialPlatformHosts({ name: 'mastodon', urlPattern: 'https://mastodon.social/@{username}' })).toEqual([
      'mastodon.social',
    ]);
  });
  it('adds only the alternates a url_pattern cannot express', () => {
    expect(socialPlatformHosts(SOCIAL_ROWS[2])).toEqual(['twitter.com', 'x.com']);
    expect(Object.keys(SOCIAL_PLATFORM_ALT_HOSTS)).not.toContain('github');
  });
  it('classifies urls against the DB rows, defaulting to website', () => {
    expect(classifySocialHost('https://x.com/someone', SOCIAL_ROWS)).toBe('twitter');
    expect(classifySocialHost('https://youtu.be/abc', SOCIAL_ROWS)).toBe('youtube');
    expect(classifySocialHost('https://example.com', SOCIAL_ROWS)).toBe('website');
    expect(classifySocialHost('not a url', SOCIAL_ROWS)).toBeNull();
  });
  it('classifies a platform added to the table with no code change', () => {
    const withMastodon = [...SOCIAL_ROWS, { name: 'mastodon', urlPattern: 'https://mastodon.social/@{u}' }];
    expect(classifySocialHost('https://mastodon.social/@ada', withMastodon)).toBe('mastodon');
  });
  it('picks a link case-insensitively over any link shape', () => {
    const links = [
      { platform: 'LinkedIn', href: 'l' },
      { platform: 'x', href: 't' },
    ];
    expect(pickSocialLink(links, 'linkedin')?.href).toBe('l');
    expect(pickSocialLink(links, 'twitter')?.href).toBe('t');
    expect(pickSocialLink(links, 'github')).toBeUndefined();
  });
});

describe('ods spacing leaf', () => {
  it('every token exists in the CSS', () => {
    for (const token of ODS_SPACING_TOKENS) {
      expect(SPACING_CSS).toContain(`--spacing-system-${token}:`);
    }
  });
  it('each mapped step is 4 x step px at EVERY breakpoint', () => {
    for (const [step, token] of Object.entries(TAILWIND_STEP_TO_ODS_TOKEN)) {
      const values = [...SPACING_CSS.matchAll(new RegExp(`--spacing-system-${token}:\\s*([0-9.]+)rem`, 'g'))].map(
        m => parseFloat(m[1]) * 16,
      );
      expect(values.length, `no declarations for ${token}`).toBeGreaterThan(0);
      for (const px of values) expect(px).toBe(Number(step) * 4);
    }
  });
  it('exports token DATA only — no runtime class builder', async () => {
    // A Tailwind class name assembled at runtime is invisible to the scanner
    // and emits no CSS, so the spacing silently vanishes. The leaf must not
    // tempt callers with a builder; spacing classes are written as literals.
    const leaf = await import('../utils/ods-spacing');
    expect(Object.keys(leaf)).not.toContain('odsSpacingClass');
    expect(Object.keys(leaf)).not.toContain('odsSpacingClassForStep');
    expect(ODS_SPACING_TOKENS).toContain('lf');
  });
});

describe('search-params engine', () => {
  it('implements THE int grammar', () => {
    expect(positiveInt(null, 1)).toBe(1);
    expect(positiveInt('', 1)).toBe(1);
    expect(positiveInt('0', 1)).toBe(1);
    expect(positiveInt('-3', 1)).toBe(1);
    expect(positiveInt('2.9', 1)).toBe(2);
    expect(positiveInt('1e3', 1)).toBe(1000);
    expect(positiveInt('0x10', 1)).toBe(16);
    expect(positiveInt('12abc', 1)).toBe(1);
    expect(positiveInt('abc', 1)).toBe(1);
    expect(positiveInt(12, 1)).toBe(12);
    expect(positiveInt('0', 0, { min: 0 })).toBe(0);
    expect(positiveInt('999', 1, { max: 100 })).toBe(100);
    // the FALLBACK is clamped too
    expect(positiveInt('abc', 999, { max: 100 })).toBe(100);
  });
  it('floors page counts at 1 and clamps pages', () => {
    expect(pageCount(0, 15)).toBe(1);
    expect(pageCount(31, 15)).toBe(3);
    expect(clampPageToTotal(9, 3)).toBe(3);
    expect(clampPageToTotal(2, 0)).toBe(1);
    expect(PAGE_PARAM_LIMITS.maxPageSize).toBe(100);
  });
  it('keeps keyof exact through fromKeys', () => {
    const keys = ['a', 'b'] as const;
    const built = fromKeys(keys, { type: 'string' } as const);
    expect(Object.keys(built)).toEqual(['a', 'b']);
  });
  it('applies default-vs-absent precedence, arrays always []', () => {
    const schema = defineParamSchema({
      lang: { type: 'string', default: 'java' },
      city: { type: 'string' },
      page: { type: 'int', default: 1, min: 1, max: 10_000 },
      ids: { type: 'array' },
    });
    const empty = parseSchemaParams(schema, new URLSearchParams(''), { absent: 'null' });
    expect(empty).toEqual({ lang: 'java', city: null, page: 1, ids: [] });
    const undef = parseSchemaParams(schema, new URLSearchParams(''));
    expect(undef.city).toBeUndefined();
    const full = parseSchemaParams(schema, new URLSearchParams('lang=go&city=austin&page=12abc&ids=a&ids=b'), {
      absent: 'null',
    });
    expect(full).toEqual({ lang: 'go', city: 'austin', page: 1, ids: ['a', 'b'] });
  });
  it('reads the FIRST value of a duplicated scalar', () => {
    const schema = defineParamSchema({ city: { type: 'string' } });
    expect(parseSchemaParams(schema, new URLSearchParams('city=a&city=b')).city).toBe('a');
  });
  it('omits defaults, empties and nulls when serializing', () => {
    const schema = defineParamSchema({
      lang: { type: 'string', default: 'java' },
      city: { type: 'string' },
      ids: { type: 'array' },
    });
    expect(shouldIncludeInUrl('java', schema.lang)).toBe(false);
    expect(shouldIncludeInUrl('go', schema.lang)).toBe(true);
    expect(shouldIncludeInUrl('', schema.city)).toBe(false);
    expect(serializeSchemaParams(schema, { lang: 'java', city: null, ids: [] })).toBe('');
    expect(serializeSchemaParams(schema, { lang: 'go', city: 'austin', ids: ['a'] })).toBe('lang=go&city=austin&ids=a');
  });
  it('joins arrays on request and builds query strings', () => {
    expect(createSearchParams({ t: ['a', 'b'] }, { arrayJoin: ';' }).toString()).toBe('t=a%3Bb');
    expect(createSearchParams({ t: ['a', '', null, 'b'] }).getAll('t')).toEqual(['a', 'b']);
    expect(withQuery('/x', '')).toBe('/x');
    expect(withQuery('/x', 'a=1')).toBe('/x?a=1');
  });
});
