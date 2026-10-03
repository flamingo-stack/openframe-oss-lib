import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BackButton } from '../layout/back-button';
import { timezoneLabel, timezoneOptions } from './timezone-select';

describe('timezone options', () => {
  it('labels a zone with its name and GMT offset', () => {
    expect(timezoneLabel('America/New_York')).toMatch(/^America\/New York \(GMT[-+]\d+\)$/);
    expect(timezoneLabel('UTC')).toMatch(/^UTC/);
  });

  it('lists the IANA zones and keeps a current zone the runtime does not list', () => {
    const options = timezoneOptions('Mars/Olympus');
    expect(options[0]).toEqual({ value: 'Mars/Olympus', label: 'Mars/Olympus' });
    expect(options.some(o => o.value === 'Europe/Rome')).toBe(true);
    expect(timezoneOptions().some(o => o.value === 'Mars/Olympus')).toBe(false);
  });
});

describe('BackButton', () => {
  it('is a link when it is given an href, a button otherwise', () => {
    const link = renderToStaticMarkup(<BackButton label="Back to list" href="/list" />);
    expect(link).toMatch(/^<a [^>]*href="\/list"/);
    expect(link).toContain('Back to list');
    expect(renderToStaticMarkup(<BackButton label="Back" />)).toMatch(/^<button type="button"/);
  });
});
