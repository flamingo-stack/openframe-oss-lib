import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsFormSkeleton } from '../settings-form-skeleton';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('SettingsFormSkeleton', () => {
  it('draws one card per entry of `cards` and one control per field', () => {
    const html = renderToString(<SettingsFormSkeleton cards={[2, 3]} />);
    expect(count(html, 'border-ods-border')).toBe(2);
    // Each field ends in its control, a full-width h-10 bar.
    expect(count(html, 'h-10 w-full')).toBe(5);
  });
});
