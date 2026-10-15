import { RuleTester } from 'eslint';
import { popupPortalPlugin } from '../../eslint-config/popup-portal.js';

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } });

const POPOVER = "import * as PopoverPrimitive from '@radix-ui/react-popover';\n";

ruleTester.run('popup-portal-container', popupPortalPlugin.rules['popup-portal-container'], {
  valid: [
    `${POPOVER}const c = <PopoverPrimitive.Portal container={container ?? undefined}><div /></PopoverPrimitive.Portal>;`,
    // Window layers keep <body>.
    "import * as DialogPrimitive from '@radix-ui/react-dialog';\nconst c = <DialogPrimitive.Portal><div /></DialogPrimitive.Portal>;",
    `${POPOVER}const Content = PopoverPrimitive.Content;`,
  ],
  invalid: [
    {
      code: `${POPOVER}const c = <PopoverPrimitive.Portal><div /></PopoverPrimitive.Portal>;`,
      errors: [{ messageId: 'missing', data: { name: 'PopoverPrimitive' } }],
    },
    {
      code: "import * as Menu from '@radix-ui/react-dropdown-menu';\nconst MenuPortal = Menu.Portal;",
      errors: [{ messageId: 'escaped', data: { name: 'Menu.Portal' } }],
    },
    {
      code: "import { Portal } from '@radix-ui/react-select';",
      errors: [{ messageId: 'escaped', data: { name: 'Portal' } }],
    },
  ],
});
