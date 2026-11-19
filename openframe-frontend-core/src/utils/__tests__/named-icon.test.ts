import { describe, expect, it } from 'vitest';
import { iconRefFor } from '../../components/chat/utils/icon-refs';
import { entityIconImages, loadNamedIcon, type NamedIconProps } from '../named-icon';

describe('loadNamedIcon', () => {
  it('loads the icon a name draws in the chat, in the caller colour', async () => {
    const loaded = await loadNamedIcon('timer', { size: 64, color: '#212121' });
    expect(loaded?.props).toEqual({ size: 64, color: '#212121' });
    expect(typeof loaded?.Icon).toBe('function');
  });

  it('reads aliases and keeps a mark one colour', async () => {
    expect(iconRefFor('openframe')?.set).toBe('OpenframeLogoIcon');
    expect((await loadNamedIcon('openframe', { size: 16, color: '#fafafa' }))?.props).toEqual({
      size: 16,
      color: '#fafafa',
      secondaryColor: '#fafafa',
    });
  });

  it('replaces a colour only a page can resolve', async () => {
    const props = (await loadNamedIcon('openmsp-logo', { size: 16, color: '#212121' }))?.props;
    expect(props?.color).toBe('#212121');
    expect(props?.tertiaryColor).toBe('#212121');
  });

  it('is null for a name that names no icon', async () => {
    expect(await loadNamedIcon('no-such-icon-at-all', { size: 16, color: '#000000' })).toBeNull();
    expect(await loadNamedIcon(null, { size: 16, color: '#000000' })).toBeNull();
  });
});

describe('entityIconImages', () => {
  it('states an upload as itself, with its media type', () => {
    expect(entityIconImages({ url: 'https://cdn.test/a.svg?v=2' }, 'https://hub.test/api/icons')).toEqual([
      { src: 'https://cdn.test/a.svg?v=2', mimeType: 'image/svg+xml' },
    ]);
  });

  it('states a library icon once per host theme, from the icons endpoint', () => {
    expect(entityIconImages({ name: 'chart pie' }, 'https://hub.test/api/icons/')).toEqual([
      {
        src: 'https://hub.test/api/icons/chart%20pie?theme=light',
        mimeType: 'image/png',
        sizes: ['96x96'],
        theme: 'light',
      },
      {
        src: 'https://hub.test/api/icons/chart%20pie?theme=dark',
        mimeType: 'image/png',
        sizes: ['96x96'],
        theme: 'dark',
      },
    ]);
  });

  it('states nothing for no icon', () => {
    expect(entityIconImages(null, 'https://hub.test/api/icons')).toEqual([]);
    expect(entityIconImages({ name: null, url: null }, 'https://hub.test/api/icons')).toEqual([]);
  });
});

describe('the one chain of what a name draws', () => {
  it('draws a name only lucide holds, as its plain svg tree, on a server too', async () => {
    expect(iconRefFor('git-pull-request')).toEqual({ lucide: 'git-pull-request' });
    const loaded = await loadNamedIcon('git-pull-request', { size: 96, color: '#212121' });
    // A loaded lucide icon is a function component (it draws its plain svg tree).
    if (!loaded) throw new Error('git-pull-request did not load');
    const draw = loaded.Icon as (props: NamedIconProps) => unknown;
    const tree = draw(loaded.props) as { type: string; props: { stroke: string; children: Array<{ type: string }> } };
    expect(tree.type).toBe('svg');
    expect(tree.props.stroke).toBe('#212121');
    expect(tree.props.children.filter(Boolean).map(child => child.type)).toEqual(['circle', 'circle', 'path', 'line']);
  });

  it('keeps the design set first and draws nothing for an unknown name', () => {
    expect(iconRefFor('timer')?.set).toBe('TimerIcon');
    expect(iconRefFor('no-such-icon-at-all')).toBeNull();
  });
});
