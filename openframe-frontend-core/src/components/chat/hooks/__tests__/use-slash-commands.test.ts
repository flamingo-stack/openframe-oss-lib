import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SlashCommandSummary } from '../../types/component.types';

const { embedAuthedFetchMock } = vi.hoisted(() => ({
  embedAuthedFetchMock: vi.fn(),
}));

vi.mock('../../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: embedAuthedFetchMock,
}));

import { fetchSlashCommands } from '../use-slash-commands';

const command = (id: string): SlashCommandSummary => ({
  id,
  description: `${id} description`,
  actions: [{ id: 'browse', label: 'Recent' }],
});

const commandsUrl = 'https://hub.example/api/docs/commands';

describe('fetchSlashCommands', () => {
  beforeEach(() => {
    embedAuthedFetchMock.mockReset();
  });

  it('fetches the full registry and filters normalized prefixes locally', async () => {
    embedAuthedFetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ commands: [command('roadmap'), command('webinars')] }),
    });

    const commands = await fetchSlashCommands(' W ', undefined, commandsUrl);

    expect(commands.map(({ id }) => id)).toEqual(['webinars']);
    expect(embedAuthedFetchMock).toHaveBeenCalledTimes(1);
    const [requestedUrl] = embedAuthedFetchMock.mock.calls[0] as [string];
    expect(new URL(requestedUrl).search).toBe('');
  });

  it('returns every command for an empty prefix', async () => {
    const registry = [command('roadmap'), command('webinars')];
    embedAuthedFetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ commands: registry }),
    });

    await expect(fetchSlashCommands('', undefined, commandsUrl)).resolves.toEqual(registry);
  });

  it('caps non-empty prefix matches at ten commands', async () => {
    embedAuthedFetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          commands: Array.from({ length: 12 }, (_, index) => command(`webinar-${index}`)),
        }),
    });

    const commands = await fetchSlashCommands('webinar', undefined, commandsUrl);

    expect(commands).toHaveLength(10);
  });
});
