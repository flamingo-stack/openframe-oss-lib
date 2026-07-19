/**
 * Text-size presets for the unified markdown engine.
 *
 * `default` / `compact` / `large` are carried over verbatim from the old
 * `SimpleMarkdownRenderer`. `article` is NEW — it reproduces the exact
 * typography the old `RichMarkdownRenderer` hardcoded per element, so
 * content surfaces (blog, case studies, releases, legal, docs) keep
 * byte-identical classes through the unification.
 *
 * ODS-TOKENS FLAG (ODS_TOKEN_RULES §Typography / §General): the `article`
 * preset carries raw px classes (`text-[32px] md:text-[40px] …`) because
 * ODS currently has NO composite tokens for long-form prose — `text-h1`/
 * `text-h2` are Azeret Mono UI-label scale and `text-h5` is uppercase,
 * so mapping prose headings onto them would visibly regress articles.
 * Per the unification plan, the missing prose-typography tokens are
 * FLAGGED here for addition to ODS; the raw-px carry-over is the
 * documented, review-gated exemption recorded in the unification PR.
 * Do NOT copy these px classes anywhere else.
 */

export type TextSizeElement =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'p' | 'li' | 'blockquote' | 'code' | 'th' | 'td';

export type TextSizeClassMap = Partial<Record<TextSizeElement, string>>;
export type TextSizePreset = 'default' | 'compact' | 'large' | 'article';
export type TextSizeConfig =
  | TextSizePreset
  | TextSizeClassMap
  | { preset: TextSizePreset; overrides: TextSizeClassMap };

export const TEXT_SIZE_PRESETS: Record<TextSizePreset, Record<TextSizeElement, string>> = {
  default: {
    h1: 'text-heading-1',
    h2: 'text-heading-2',
    h3: 'text-2xl md:text-3xl',
    h4: 'text-xl',
    h5: 'text-lg md:text-xl',
    h6: 'text-base md:text-lg',
    p: 'md:text-h4 lg:text-h4',
    li: 'text-base md:text-lg',
    blockquote: 'text-lg',
    code: 'text-[14px]',
    th: 'text-xs md:text-sm',
    td: 'text-xs md:text-sm',
  },
  compact: {
    h1: 'text-heading-2',
    h2: 'text-heading-3',
    h3: 'text-xl md:text-2xl',
    h4: 'text-lg md:text-xl',
    h5: 'text-base md:text-lg',
    h6: 'text-sm md:text-base',
    p: 'text-base md:text-lg',
    li: 'text-base md:text-lg',
    blockquote: 'text-base md:text-lg',
    code: 'text-[13px]',
    th: 'text-xs md:text-sm',
    td: 'text-xs md:text-sm',
  },
  large: {
    h1: 'text-heading-1',
    h2: 'text-heading-1',
    h3: 'text-heading-2',
    h4: 'text-2xl md:text-3xl',
    h5: 'text-xl md:text-2xl',
    h6: 'text-lg md:text-xl',
    p: 'text-h3',
    li: 'text-lg md:text-xl',
    blockquote: 'text-xl md:text-2xl',
    code: 'text-[16px]',
    th: 'text-sm md:text-base',
    td: 'text-sm md:text-base',
  },
  // Old RichMarkdownRenderer typography, byte-for-byte (see header note).
  article: {
    h1: 'text-[32px] md:text-[40px] lg:text-[48px] leading-[1.25]',
    h2: 'text-[28px] md:text-[32px]',
    h3: 'text-[24px] md:text-[28px]',
    h4: 'text-[20px] md:text-[22px]',
    h5: 'text-[18px] md:text-[20px]',
    h6: 'text-[16px] md:text-[18px]',
    // Full class string incl. spacing/leading — `cn` (tailwind-merge)
    // resolves these OVER the base map's `leading-relaxed mb-4`, keeping
    // Rich's article rhythm (`my-4`, `leading-[1.6]`, `font-sans`).
    p: 'font-sans text-[16px] md:text-[18px] lg:text-[20px] leading-[1.6] my-4',
    li: 'text-[16px] md:text-[18px]',
    blockquote: 'text-[1.125em]',
    code: 'text-[14px]',
    th: 'text-xs md:text-sm',
    td: 'text-xs md:text-sm',
  },
};

export function resolveTextSizeConfig(config?: TextSizeConfig): Record<TextSizeElement, string> {
  const defaultSizes = TEXT_SIZE_PRESETS.default;
  if (!config) return defaultSizes;
  if (typeof config === 'string') return TEXT_SIZE_PRESETS[config];
  if ('preset' in config) return { ...TEXT_SIZE_PRESETS[config.preset], ...config.overrides };
  return { ...defaultSizes, ...config };
}
