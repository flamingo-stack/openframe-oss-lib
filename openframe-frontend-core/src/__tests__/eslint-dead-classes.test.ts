import { RuleTester } from 'eslint';
import { deadClassesPlugin } from '../../eslint-config/dead-classes.js';

const dead = (...tokens: string[]) => tokens.map(token => ({ messageId: 'dead', data: { token } }));

new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
}).run('no-dead-class', deadClassesPlugin.rules['no-dead-class'], {
  valid: [
    // Utilities the preset generates, variants, arbitrary values and properties, the ODS tokens.
    "const TITLE_CLASS = 'px-12 md:!w-full bg-ods-bg text-h3 content-md:grid-cols-2 [transition-duration:180ms]'",
    "cn('lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)]', 'hover:scale-[1.02]', 'data-[state=open]:animate-in')",
    // Defined by the package's own stylesheets, not by Tailwind.
    'const c = <div className="simple-markdown-renderer ods-viewport-layer" />',
    // Not a class list: a compared value, a variant name, an index, cva's variant selection.
    "cn(side === 'right' && 'right-0', ALIGN_CLASS[align ?? 'left'])",
    "cva('flex', { variants: { tone: { accent: 'bg-ods-accent' } }, defaultVariants: { tone: 'accent' } })",
    "cva('flex', { compoundVariants: [{ variant: 'accent', attach: 'end', class: 'border-l' }] })",
    // A class string outside a class context is not read.
    "const label = 'text-body-sm'",
    // Allowed by option.
    { code: "const EMAIL_CLASS = 'm-btn'", options: [{ allow: ['m-btn'] }] },
    // A token cut by an interpolation is not judged.
    'cn(`w-${size} text-ods-text-primary`)',
  ],
  invalid: [
    {
      code: "const TITLE_CLASS = 'text-body-sm bg-ods-background prose prose-lg'",
      errors: dead('text-body-sm', 'bg-ods-background', 'prose', 'prose-lg'),
    },
    {
      code: '<div className="md:w-full! overflow-wrap-anywhere" />',
      errors: dead('md:w-full!', 'overflow-wrap-anywhere'),
    },
    { code: "cn('flex', open && 'hover:bg-[var(--color-info)]/90')", errors: dead('hover:bg-[var(--color-info)]/90') },
    { code: "function Bar({ barClassName = 'w-128' }) {}", errors: dead('w-128') },
    {
      code: "cn('duration-[180ms] transition-transform')",
      errors: [
        {
          messageId: 'ambiguous',
          data: { token: 'duration-[180ms]', family: 'duration', property: 'transition-duration', value: '180ms' },
        },
      ],
    },
  ],
});
