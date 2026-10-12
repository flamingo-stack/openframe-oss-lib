import { RuleTester } from 'eslint';
import { layoutVariantsPlugin } from '../../eslint-config/layout-variants.js';

const mixed = (viewport: string, content: string) => [{ messageId: 'mixed', data: { viewport, content } }];

new RuleTester().run('no-mixed-layout-variants', layoutVariantsPlugin.rules['no-mixed-layout-variants'], {
  valid: [
    "const c = 'grid md:grid-cols-2 lg:grid-cols-4'",
    "const c = 'grid content-md:grid-cols-2 content-max-lg:gap-2'",
    // Stacked in one class: narrow content in a wide window (PageActions).
    "const c = 'hidden md:content-max-md:flex md:content-md:flex'",
    // `content-*` utilities are not the variant.
    "const c = 'md:flex content-center content-none'",
    // Two strings are two elements as far as the rule can tell.
    "const c = [open ? 'md:w-96' : 'content-md:w-96']",
  ],
  invalid: [
    {
      code: "const c = 'grid sm:grid-cols-2 content-lg:grid-cols-4'",
      errors: mixed('sm:grid-cols-2', 'content-lg:grid-cols-4'),
    },
    {
      code: "const c = 'content-md:block max-md:hidden'",
      errors: mixed('max-md:hidden', 'content-md:block'),
    },
    {
      code: 'const c = `flex ${gap} md:hover:flex-row hover:content-md:flex-col`',
      errors: mixed('md:hover:flex-row', 'hover:content-md:flex-col'),
    },
  ],
});
