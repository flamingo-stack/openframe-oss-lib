import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { getPlatformBrandClasses } from '../../utils/platform-identity';

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

/** A sentence mark inside a title: `.`, `:`, `?` or `!` that ends a sentence (followed by a space or the end). */
const SENTENCE_MARK = /([.:?!]+)(?=\s|$)/g;
const ONLY_MARKS = /^\s*[.:?!]+\s*$/;

/**
 * The accent a heading's marks take, as an ODS class: a named platform's brand
 * accent (`getPlatformBrandClasses`, the one platform → token table), else the
 * accent of the platform the page runs on (`text-ods-accent`).
 */
export function headingAccentClass(platform?: string | null): string {
  return platform ? getPlatformBrandClasses(platform).accentText : 'text-ods-accent';
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
export function accentSentenceMarks(node: ReactNode, platform?: string | null): ReactNode {
  return accentMarks(node, headingAccentClass(platform));
}

function accentMarks(node: ReactNode, accentClassName: string): ReactNode {
  if (typeof node === 'string') {
    // A string that is ONLY marks is one a caller already wrapped in its own colour: keep it.
    if (ONLY_MARKS.test(node)) return node;
    const parts = node.split(SENTENCE_MARK);
    if (parts.length === 1) return node;
    return parts.map((part, index) =>
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
  /** The small label above the heading (Azeret Mono, uppercase, accent colour). */
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
   * The brand whose accent the eyebrow and the sentence marks take, for a section
   * that shows ANOTHER product. Omitted: the platform the page runs on.
   */
  platform?: string | null;
  /** Extra classes on the outer row. */
  className?: string;
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
  platform,
  className,
}: SectionHeadingProps) {
  const accentClassName = headingAccentClass(platform);
  const layout = SECTION_HEADING_LAYOUT[level];
  const Tag = level === 'page' ? 'h1' : 'h2';
  const stack = (
    <div className={layout.stack}>
      {eyebrow ? <span className={`text-h5 ${accentClassName}`}>{eyebrow}</span> : null}
      <Tag className={layout.heading}>
        {accentSentenceMarks(title, platform)}
        {punctuation ? <span className={accentClassName}>{punctuation}</span> : null}
      </Tag>
      {intro ? <div className={layout.intro}>{intro}</div> : null}
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
