import { describe, expect, it } from 'vitest';
import { cn } from '../cn';

describe('cn and the ODS typography utilities', () => {
  it.each(['text-shell-body', 'text-note', 'text-wordmark', 'text-badge', 'text-h4'])(
    'keeps %s beside a text colour',
    utility => {
      expect(cn(utility, 'text-ods-text-primary').split(' ')).toEqual([utility, 'text-ods-text-primary']);
    },
  );
});
