import { describe, expect, it } from 'vitest';
import { getProxiedImageUrl } from '../image-proxy';

const PROXY = '/content/api/image-proxy';
const STORAGE_HOST = 'abc.supabase.co';
const OWN_LOGO = `https://${STORAGE_HOST}/storage/v1/object/public/logos/acme.png`;

function resolve(url: string, skipDomains: string[] = [STORAGE_HOST]) {
  return getProxiedImageUrl(url, { proxyPrefix: PROXY, skipDomains });
}

function proxied(url: string) {
  return `${PROXY}?url=${encodeURIComponent(url)}`;
}

describe('getProxiedImageUrl skip list', () => {
  it('loads an image on a listed host directly', () => {
    expect(resolve(OWN_LOGO)).toBe(OWN_LOGO);
  });

  it('matches the host whatever its case', () => {
    const url = 'https://ABC.Supabase.CO/storage/v1/object/public/logos/acme.png';
    expect(resolve(url)).toBe(url);
  });

  it('skips a subdomain of a listed domain, the way a registrable domain is listed', () => {
    const url = 'https://app.openmsp.ai/storage/v1/object/public/logos/acme.png';
    expect(resolve(url, ['openmsp.ai'])).toBe(url);
  });

  it('compares a listed host:port with the port the URL carries', () => {
    const url = 'http://127.0.0.1:54321/storage/v1/object/public/logos/acme.png';
    expect(resolve(url, ['127.0.0.1:54321'])).toBe(url);
  });

  it('proxies another Supabase project', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/logos/acme.png';
    expect(resolve(url)).toBe(proxied(url));
  });

  it('proxies a host that only ends in the same letters', () => {
    const url = 'https://xabc.supabase.co/storage/v1/object/public/logos/acme.png';
    expect(resolve(url)).toBe(proxied(url));
  });

  it('proxies a third-party URL that names the listed host in its path or query', () => {
    const inPath = `https://cdn.example.com/${STORAGE_HOST}/acme.png`;
    const inQuery = `https://cdn.example.com/acme.png?from=${STORAGE_HOST}`;
    expect(resolve(inPath)).toBe(proxied(inPath));
    expect(resolve(inQuery)).toBe(proxied(inQuery));
  });

  it('proxies a host that only starts with the listed one', () => {
    const url = `https://${STORAGE_HOST}.example.com/acme.png`;
    expect(resolve(url)).toBe(proxied(url));
  });

  it('proxies everything when an empty entry reaches the list', () => {
    const url = 'https://cdn.example.com/acme.png';
    expect(resolve(url, [''])).toBe(proxied(url));
  });

  it('proxies a URL the parser refuses instead of throwing', () => {
    const url = 'https://exa mple.com/acme.png';
    expect(resolve(url)).toBe(proxied(url));
  });
});
