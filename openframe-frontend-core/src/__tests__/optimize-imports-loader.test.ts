import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { createOptimizer } = createRequire(import.meta.url)('../../scripts/optimize-imports-loader.cjs') as {
  createOptimizer: (map: {
    package: string;
    entries: Record<string, Record<string, [string, string]>>;
  }) => (source: string) => string;
};

/** The loader a consumer's build runs: an import of an entry becomes an import of the module that defines the name. */
const optimize = createOptimizer({
  package: '@acme/lib',
  entries: {
    './ui': {
      Button: ['dist/ui/button.js', 'Button'],
      Card: ['dist/ui/card.js', 'Card'],
      Chart: ['dist/ui/chart.js', 'default'],
    },
    './utils': { cn: ['dist/utils/cn.js', 'cn'] },
  },
});

describe('optimize-imports-loader', () => {
  it('names the module that defines each imported name', () => {
    expect(optimize("import { Button, Card } from '@acme/lib/ui'")).toBe(
      "import { Button } from '@acme/lib/dist/ui/button.js'; import { Card } from '@acme/lib/dist/ui/card.js';",
    );
  });

  it('keeps a local alias, and a default export under its name', () => {
    expect(optimize("import { Button as Primary, Chart } from '@acme/lib/ui'")).toBe(
      "import { Button as Primary } from '@acme/lib/dist/ui/button.js'; import { default as Chart } from '@acme/lib/dist/ui/chart.js';",
    );
  });

  it('leaves a name the map does not hold in an import of the entry, as a type import when all are types', () => {
    expect(optimize("import { Button, type ButtonProps } from '@acme/lib/ui'")).toBe(
      "import { Button } from '@acme/lib/dist/ui/button.js'; import type { ButtonProps } from '@acme/lib/ui';",
    );
    expect(optimize("import { Button, Unknown } from '@acme/lib/ui'")).toBe(
      "import { Button } from '@acme/lib/dist/ui/button.js'; import { Unknown } from '@acme/lib/ui';",
    );
  });

  it('rewrites a re-export the same way', () => {
    expect(optimize('export { cn } from "@acme/lib/utils";')).toBe('export { cn } from "@acme/lib/dist/utils/cn.js";');
  });

  it('keeps every later line on its line number', () => {
    const source = "'use client'\nimport {\n  Button,\n  Card,\n} from '@acme/lib/ui'\nconst after = 1\n";
    const out = optimize(source);
    expect(out.split('\n')).toHaveLength(source.split('\n').length);
    expect(out.split('\n')[5]).toBe('const after = 1');
    expect(out.startsWith("'use client'\n")).toBe(true);
  });

  it('leaves everything else exactly as it is', () => {
    for (const source of [
      "import type { ButtonProps } from '@acme/lib/ui'",
      "import * as Ui from '@acme/lib/ui'",
      "import Ui from '@acme/lib/ui'",
      "import { Button } from '@acme/lib/unknown-entry'",
      "import { Button } from '@other/lib/ui'",
      'const text = "import { Button } from \'@acme/lib/ui\'"',
      "import { OnlyUnknown } from '@acme/lib/ui'",
    ]) {
      expect(optimize(source)).toBe(source);
    }
  });
});
