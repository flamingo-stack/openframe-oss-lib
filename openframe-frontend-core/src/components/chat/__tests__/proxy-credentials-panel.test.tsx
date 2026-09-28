import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { applyProxyAuth, clearEmbedProxyAuth, setEmbedProxyAuth } from '../../../utils/embed-proxy-auth-storage';
import { ProxyCredentialsPanel } from '../proxy-credentials-panel';

afterEach(() => clearEmbedProxyAuth());

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`));
const type = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });

describe('ProxyCredentialsPanel', () => {
  it('previews and saves every header the form holds', () => {
    render(<ProxyCredentialsPanel />);
    type('Platform API key', 'fpk_openframe_abcdefghijklmnop');
    type('Act as', 'Jane@Example.com');
    type('Origin URL', 'https://acme.openframe.ai');
    type('Visitor IP', '203.0.113.4');
    type('Country', 'DE');

    expect(screen.getByText('X-Chat-Origin-Url:')).toBeTruthy();
    expect(screen.getByText('Bearer fpk_openframe_…mnop')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(applyProxyAuth('/api/docs/chat').headers).toEqual({
      Authorization: 'Bearer fpk_openframe_abcdefghijklmnop',
      'Content-Type': 'application/json',
      'X-Chat-Act-As': 'jane@example.com',
      'X-Chat-Country': 'DE',
      'X-Chat-Ip': '203.0.113.4',
      'X-Chat-Origin-Url': 'https://acme.openframe.ai',
    });
  });

  it('refuses to save an origin that is not https', () => {
    render(<ProxyCredentialsPanel />);
    type('Platform API key', 'fpk_openframe_abcdefghijklmnop');
    type('Act as', 'jane@example.com');
    type('Origin URL', 'http://evil.example.com');

    expect(screen.getByText('Origin URL must start with https:// (or http://localhost)')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(true);
  });

  it('loads what was saved, keeping the key out of the input', () => {
    setEmbedProxyAuth({
      email: 'jane@example.com',
      originUrl: 'https://acme.openframe.ai',
      secret: 'fpk_openframe_abcdefghijklmnop',
    });
    render(<ProxyCredentialsPanel />);

    expect(input('Origin URL').value).toBe('https://acme.openframe.ai');
    expect(input('Platform API key').value).toBe('');
    expect(screen.getByText('Active: jane@example.com')).toBeTruthy();
  });
});
