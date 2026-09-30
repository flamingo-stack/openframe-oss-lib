import { afterEach, describe, expect, it } from 'vitest';
import { applyProxyAuth, clearEmbedProxyAuth, getEmbedProxyAuth, setEmbedProxyAuth } from '../embed-proxy-auth-storage';

afterEach(() => clearEmbedProxyAuth());

describe('embed proxy auth', () => {
  it('sends every saved field as its X-Chat header', () => {
    setEmbedProxyAuth({
      avatarUrl: 'https://example.com/a.png',
      country: 'DE',
      email: ' Jane@Example.com ',
      firstName: 'Jane',
      ip: '203.0.113.4',
      lastName: 'Doe',
      originUrl: ' https://acme.openframe.ai ',
      secret: 'fpk_openframe_x',
      visitorId: 'visitor-42',
    });

    expect(applyProxyAuth('/api/docs/chat')).toEqual({
      headers: {
        Authorization: 'Bearer fpk_openframe_x',
        'Content-Type': 'application/json',
        'X-Chat-Act-As': 'jane@example.com',
        'X-Chat-Avatar-Url': 'https://example.com/a.png',
        'X-Chat-Country': 'DE',
        'X-Chat-First-Name': 'Jane',
        'X-Chat-Ip': '203.0.113.4',
        'X-Chat-Last-Name': 'Doe',
        'X-Chat-Origin-Url': 'https://acme.openframe.ai',
        'X-Chat-User-Id': 'visitor-42',
      },
      url: '/api/docs/chat',
    });
  });

  it('leaves an unset or blank optional field off the wire', () => {
    setEmbedProxyAuth({ email: 'jane@example.com', originUrl: '   ', secret: 'fpk_openframe_x' });

    expect(getEmbedProxyAuth()?.originUrl).toBeUndefined();
    expect(applyProxyAuth('/api/docs/chat').headers).toEqual({
      Authorization: 'Bearer fpk_openframe_x',
      'Content-Type': 'application/json',
      'X-Chat-Act-As': 'jane@example.com',
    });
  });

  it('attaches nothing without saved credentials', () => {
    expect(applyProxyAuth('/api/docs/chat').headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
