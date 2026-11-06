import { RuleTester } from 'eslint';
import { navigationPlugin } from '../../eslint-config/navigation.js';

new RuleTester().run('no-navigation-fallback', navigationPlugin.rules['no-navigation-fallback'], {
  valid: [
    // The executor alone.
    'function onClick(e) { executeNavigation({ event: e, runtime, href, path, targetPlatform, hostRoute }); }',
    'function open() { executeNewTabNavigation({ runtime, href, targetPlatform: null }); }',
    // A router call with no executor in the function: a query-string write, not a link.
    'function setPage(p) { router.replace(`${pathname}?page=${p}`); }',
    // Two components in one file: one follows links, the other writes the URL.
    'function Row() { const go = e => executeNavigation({ event: e, runtime, href }); }\n' +
      'function List() { router.replace(`${pathname}?q=1`); }',
    // The module that defines the executor implements navigating.
    'export function executeNavigation(args) { window.location.assign(args.href); }',
  ],
  invalid: [
    {
      // CU-17tkuw61kfy: every caller handed the executor `router.push`.
      code: 'function onClick(e) { executeNavigation({ event: e, runtime, href, fallbackNavigate: router.push }); }',
      errors: [{ messageId: 'option' }],
    },
    {
      code: 'function go() { executeNavigationImperative({ runtime, href, fallback: href => location.assign(href) }); }',
      errors: [{ messageId: 'option' }, { messageId: 'beside' }],
    },
    {
      // A second path after the executor.
      code: 'function onClick(e) { if (!executeNavigation({ event: e, runtime, href })) router.push(href); }',
      errors: [{ messageId: 'beside' }],
    },
    {
      // A new tab opened by hand beside the executor.
      code:
        'function onSelect(row, wantsNewTab) {\n' +
        "  if (wantsNewTab) { window.open(row.href, '_blank'); return; }\n" +
        '  executeNavigationImperative({ runtime, href: row.href });\n' +
        '}',
      errors: [{ messageId: 'beside' }],
    },
    {
      code: 'function onClick(e) { executeNavigation({ event: e, runtime, href }) || (window.location.href = href); }',
      errors: [{ messageId: 'beside' }],
    },
    {
      // A handler nested in a component: the component follows links, so it navigates only through the executor.
      code:
        'function Card() {\n' +
        '  const onClick = e => executeNavigation({ event: e, runtime, href });\n' +
        '  const onKey = () => router.push(href);\n' +
        '}',
      errors: [{ messageId: 'beside' }],
    },
  ],
});
