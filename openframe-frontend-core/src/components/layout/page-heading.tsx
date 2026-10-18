import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { getPlatformBrandClasses } from '../../utils/platform-identity';
import { TextLineSkeleton } from '../loading/unified-skeleton';

/**
 * THE page-title style — the ODS `text-h1` token (`--font-size-h1-title` =
 * 40 / 48 / 56px, Azeret Mono semibold), which already owns the responsive
 * letter-spacing (-0.02em). Mirrors the global `h1 { @apply text-h1 }` base, so
 * every page heading is the SAME size across the lib and every consuming app.
 *
 * Single source of truth — do NOT hardcode a px size or re-assert the token's
 * tracking; render `<PageHeading>` (or, for the rare non-h1 caller, apply
 * `PAGE_HEADING_CLASS`).
 */
export const PAGE_HEADING_CLASS = 'text-h1 text-ods-text-primary';

/**
 * THE section-heading style — the ODS `text-h2` sub-title token
 * (`--font-size-h2-sub-title` = 24 / 32 / 32px), one step below the page
 * title so a section `<h2>`/`<h3>` is always visually distinguishable from
 * the page's `<h1>`. Same single-source rule as PAGE_HEADING_CLASS: never
 * hardcode a px ramp or re-assert the token's tracking on a section heading.
 */
export const SECTION_HEADING_CLASS = 'text-h2 text-ods-text-primary';

const DESCRIPTION_CLASS =
  'mt-6 max-w-[640px] font-body text-[16px] content-md:text-[18px] leading-[24px] content-md:leading-[28px] text-ods-text-secondary';

export interface PageHeadingProps {
  /** Heading content — plain text or nodes (e.g. an accent <span>). */
  children: ReactNode;
  /**
   * Heading level. Defaults to 'h1' (exactly one per page). Pass 'h2' where the
   * page already renders an <h1> above (e.g. a hero/featured item).
   */
  as?: 'h1' | 'h2';
  /** Optional supporting copy rendered as a <p> beneath the heading. */
  description?: ReactNode;
  /** Extra classes merged onto the heading (margins, width, truncate, etc.). */
  className?: string;
  /** Extra classes merged onto the description <p>. */
  descriptionClassName?: string;
}

/**
 * Unified page heading. Renders the canonical page-title <h1> (or <h2>) plus an
 * optional description, so every page shares one consistent style instead of
 * duplicating the class string. Layout (PageContainer, margins, surrounding
 * sections) stays with the caller — this owns only the heading + description.
 */
export function PageHeading({
  children,
  as: Tag = 'h1',
  description,
  className,
  descriptionClassName,
}: PageHeadingProps) {
  const headingClass = className ? `${PAGE_HEADING_CLASS} ${className}` : PAGE_HEADING_CLASS;
  const descClass = descriptionClassName ? `${DESCRIPTION_CLASS} ${descriptionClassName}` : DESCRIPTION_CLASS;
  // `description` is a ReactNode, so `description={cond && '...'}` can pass a
  // boolean `false` — exclude it (and empty string) so we never render an empty
  // <p> that adds phantom vertical gap beneath the heading.
  const hasDescription = description != null && description !== '' && typeof description !== 'boolean';
  return (
    <>
      <Tag className={headingClass}>{accentSentenceMarks(children)}</Tag>
      {hasDescription && <p className={descClass}>{description}</p>}
    </>
  );
}

/**
 * THE way a heading is drawn on more than one line: each line on its own line,
 * with a space before every break. The space is what keeps the heading's TEXT
 * (what search engines, screen readers and link previews read) in words:
 * "own. Approved", never "own.Approved". It sits at the end of a line, where it
 * draws nothing. An empty line is a blank line.
 *
 * Every multi-line title goes through this; never write a bare `<br />` or one
 * block `<span>` per line in a heading. The lines are its children, so anything
 * that walks a title's children (the accent marks) reaches every line.
 */
export interface HeadingLinesProps {
  /** The title's lines, top to bottom: one child per line. */
  children: ReactNode;
}

export function HeadingLines({ children }: HeadingLinesProps) {
  return (
    <>
      {Children.toArray(children).map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a title's lines never reorder
        <Fragment key={index}>
          {index > 0 ? (
            <>
              {' '}
              <br />
            </>
          ) : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}

/** A sentence mark inside a title: `.`, `:`, `?` or `!` that ends a sentence (followed by a space or the end). */
const SENTENCE_MARK = /([.:?!]+)(?=\s|$)/g;
const ONLY_MARKS = /^\s*[.:?!]+\s*$/;

/**
 * Which of a brand's two colours a heading's eyebrow and marks take: its accent
 * (the default) or its secondary colour (`PLATFORM_BRAND`'s `secondaryStem`:
 * OpenFrame's marketing pages are cyan there, its product screens yellow).
 * `secondary` needs a named `platform`.
 */
export type HeadingAccentTone = 'accent' | 'secondary';

/**
 * The accent a heading's marks take, as an ODS class: a named platform's brand
 * accent (`getPlatformBrandClasses`, the one platform → token table), else the
 * accent of the platform the page runs on (`text-ods-accent`).
 */
export function headingAccentClass(platform?: string | null, tone: HeadingAccentTone = 'accent'): string {
  if (!platform) return 'text-ods-accent';
  const classes = getPlatformBrandClasses(platform);
  return tone === 'secondary' ? classes.secondaryText : classes.accentText;
}

/**
 * A title with EVERY sentence mark in the accent colour, not only the last one:
 * "Remote all year. Together once a year." has two accent dots. Every heading
 * goes through it (`SectionHeading`, `PageHeading`, and any title set by hand).
 * `platform` names the brand whose accent is used, for a section that shows
 * another product; omitted, it is the platform the page runs on.
 *
 * Text is walked through fragments and elements (a highlighted `<span>` keeps
 * its own colour for its letters). A mark inside a number or a version
 * (`$6.7M`, `v1.5.0`) is not a sentence mark and is left alone.
 */
export function accentSentenceMarks(
  node: ReactNode,
  platform?: string | null,
  tone: HeadingAccentTone = 'accent',
): ReactNode {
  return accentMarks(node, headingAccentClass(platform, tone));
}

function accentMarks(node: ReactNode, accentClassName: string): ReactNode {
  if (typeof node === 'string') {
    // A string that is ONLY marks is one a caller already wrapped in its own colour: keep it.
    if (ONLY_MARKS.test(node)) return node;
    const parts = node.split(SENTENCE_MARK);
    if (parts.length === 1) return node;
    // One node for one string, so a list of children keeps its length (each of `HeadingLines`' lines stays one line).
    return (
      <>
        {parts.map((part, index) =>
          // `split` with one capture group alternates text, mark, text, mark...
          index % 2 === 1 ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one string never reorder
            <span key={index} className={accentClassName}>
              {part}
            </span>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one string never reorder
            <Fragment key={index}>{part}</Fragment>
          ),
        )}
      </>
    );
  }
  if (Array.isArray(node)) {
    return Children.map(node as ReactNode[], child => accentMarks(child, accentClassName));
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (element.props.children === undefined) return node;
    return cloneElement(element, undefined, accentMarks(element.props.children, accentClassName));
  }
  return node;
}

const SECTION_HEADING_LAYOUT = {
  page: {
    stack: 'flex flex-col gap-[var(--spacing-system-lf)]',
    heading: PAGE_HEADING_CLASS,
    intro: 'max-w-[600px] text-h4 text-ods-text-primary',
  },
  section: {
    stack: 'flex max-w-[640px] flex-col gap-[var(--spacing-system-sf)]',
    heading: SECTION_HEADING_CLASS,
    intro: 'text-h4 text-ods-text-secondary',
  },
} as const;

export interface SectionHeadingProps {
  /**
   * The small label above the heading (Azeret Mono, uppercase, accent colour).
   * On a page heading (`level="page"`) it is part of the `<h1>`: a hero's
   * eyebrow names what the page is about ("Endpoint management software") above
   * its positioning line, so the page's heading, and its accessible name, say
   * both. The element takes no box of its own, so the eyebrow and the title keep
   * their two places in the stack. On a section heading it stays a label beside
   * the `<h2>`, whose accessible name is its title alone.
   */
  eyebrow?: ReactNode;
  /** The heading text; a node when part of it is highlighted. Every sentence mark in it is drawn in the accent colour. */
  title: ReactNode;
  /** The accent mark that closes the heading (`.`, `:`, `?`). `null` for none. Default `.`. */
  punctuation?: string | null;
  /** The supporting copy under the heading. */
  intro?: ReactNode;
  /** Something at the far end of the heading's row (a "See all" link). */
  action?: ReactNode;
  /** `page` = the page's `<h1>` (a hero); `section` = an `<h2>`. Default `section`. */
  level?: 'page' | 'section';
  /**
   * Draw the heading's text without a heading element. For a loading state that
   * shows a heading's words before the content that carries the real heading
   * arrives: the page then never holds the same `<h1>` twice.
   */
  presentational?: boolean;
  /**
   * The brand whose accent the eyebrow and the sentence marks take, for a section
   * that shows ANOTHER product. Omitted: the platform the page runs on.
   */
  platform?: string | null;
  /** Which of `platform`'s colours: its accent (default) or its secondary colour. */
  tone?: HeadingAccentTone;
  /** Extra classes on the outer row. */
  className?: string;
}

/**
 * THE eyebrow: the small label over a heading (Azeret Mono, uppercase, in the accent).
 * `SectionHeading` draws it, and so does any heading that is not a `SectionHeading`
 * (a call-to-action band's label), so a change to the eyebrow lands everywhere.
 */
export function SectionEyebrow({
  children,
  platform,
  tone = 'accent',
  className,
}: {
  children: ReactNode;
  platform?: string | null;
  tone?: HeadingAccentTone;
  className?: string;
}) {
  return <span className={['text-h5', headingAccentClass(platform, tone), className].filter(Boolean).join(' ')}>{children}</span>;
}

/**
 * THE heading block of a page section or hero: an eyebrow, the heading with its
 * accent punctuation, an intro, and an optional action at the end of the row.
 * Every section on every site composes this, so a change to the layout lands
 * everywhere at once.
 */
export function SectionHeading({
  eyebrow,
  title,
  punctuation = '.',
  intro,
  action,
  level = 'section',
  presentational = false,
  platform,
  tone = 'accent',
  className,
}: SectionHeadingProps) {
  const accentClassName = headingAccentClass(platform, tone);
  const layout = SECTION_HEADING_LAYOUT[level];
  const Tag = presentational ? 'div' : level === 'page' ? 'h1' : 'h2';
  const eyebrowNode = eyebrow ? <SectionEyebrow platform={platform} tone={tone}>{eyebrow}</SectionEyebrow> : null;
  const headingText = (
    <>
      {accentSentenceMarks(title, platform, tone)}
      {punctuation ? <span className={accentClassName}>{punctuation}</span> : null}
    </>
  );
  const stack = (
    <div className={layout.stack}>
      {eyebrowNode && level === 'page' ? (
        // `contents`: the element names the heading and draws no box, so the stack lays its two children out as before.
        <Tag className="contents">
          {eyebrowNode}
          {/* A space between the eyebrow and the title, so the heading's text reads "Eyebrow Title", not "EyebrowTitle". */}{' '}
          <span className={`block ${layout.heading}`} data-section-heading>
            {headingText}
          </span>
        </Tag>
      ) : (
        <>
          {eyebrowNode}
          <Tag className={layout.heading} data-section-heading>
            {headingText}
          </Tag>
        </>
      )}
      {intro ? (
        <div className={layout.intro} data-section-intro>
          {intro}
        </div>
      ) : null}
    </div>
  );
  if (!action) return className ? <div className={className}>{stack}</div> : stack;
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-[var(--spacing-system-mf)]${className ? ` ${className}` : ''}`}
    >
      {stack}
      {action}
    </div>
  );
}

export interface SectionHeadingSkeletonProps {
  level?: 'page' | 'section';
  /** The eyebrow: static copy, drawn as it is. */
  eyebrow?: ReactNode;
  /** The title bar's width (a width class). Default `w-2/3`. */
  titleWidth?: string;
  /** The intro's lines: `true` is two. Omitted: no intro. */
  intro?: boolean | 1 | 2 | 3;
  /** Something at the far end of the row, drawn as given. */
  action?: ReactNode;
  platform?: string | null;
  tone?: HeadingAccentTone;
  className?: string;
}

/**
 * A heading whose title and intro are read data (a category's name and description), while they are read: the same
 * stack, the eyebrow for real, a one-line bar at the heading's type step and a bar per intro line at the intro's.
 * No heading element is drawn: the loaded heading is the page's one.
 */
export function SectionHeadingSkeleton({
  level = 'section',
  eyebrow,
  titleWidth = 'w-2/3',
  intro,
  action,
  platform,
  tone = 'accent',
  className,
}: SectionHeadingSkeletonProps) {
  const layout = SECTION_HEADING_LAYOUT[level];
  const introLines = intro === true ? 2 : intro || 0;
  const stack = (
    <div className={layout.stack} aria-hidden>
      {eyebrow ? (
        <SectionEyebrow platform={platform} tone={tone}>
          {eyebrow}
        </SectionEyebrow>
      ) : null}
      <div className={layout.heading}>
        <TextLineSkeleton type="inherit" className={titleWidth} />
      </div>
      {introLines > 0 ? (
        <div className={layout.intro}>
          {Array.from({ length: introLines }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton lines never reorder
            <TextLineSkeleton key={i} type="inherit" className={i === introLines - 1 && introLines > 1 ? 'w-2/3' : 'w-full'} />
          ))}
        </div>
      ) : null}
    </div>
  );
  if (!action) return className ? <div className={className}>{stack}</div> : stack;
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-[var(--spacing-system-mf)]${className ? ` ${className}` : ''}`}
    >
      {stack}
      {action}
    </div>
  );
}
