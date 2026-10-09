import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadsPublic } from '../../types/downloads';
import { resetDownloadsStore, useDownloads } from '../use-downloads';

const DATA: DownloadsPublic = {
  desktop: [
    {
      id: 'mac',
      kind: 'binary',
      os: 'mac',
      architecture: 'universal',
      url: 'https://gateway.test/mac',
      command: null,
      minOsLabel: null,
      label: null,
    },
  ],
};

const fetchMock = vi.fn<typeof fetch>();

function Probe({ id, enabled = true, initialData }: { id: string; enabled?: boolean; initialData?: DownloadsPublic }) {
  const { data, isLoading, error } = useDownloads({ endpoint: '/api/downloads', enabled, initialData });
  return <p data-testid={id}>{error ? 'error' : isLoading ? 'loading' : (data?.desktop[0]?.url ?? 'none')}</p>;
}

beforeEach(() => {
  resetDownloadsStore();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDownloads', () => {
  it('reads the list from the server once for every caller on the page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DATA), { status: 200 }));
    render(
      <>
        <Probe id="a" />
        <Probe id="b" />
        <Probe id="c" />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId('c')).toHaveTextContent('https://gateway.test/mac'));
    expect(screen.getByTestId('a')).toHaveTextContent('https://gateway.test/mac');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when it is off', () => {
    render(<Probe id="a" enabled={false} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('a')).toHaveTextContent('none');
  });

  it('takes the server copy as the answer, with no request', () => {
    render(<Probe id="a" initialData={DATA} />);
    expect(screen.getByTestId('a')).toHaveTextContent('https://gateway.test/mac');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a failed read', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    render(<Probe id="a" />);
    await waitFor(() => expect(screen.getByTestId('a')).toHaveTextContent('error'));
  });
});
