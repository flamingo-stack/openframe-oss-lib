// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIosNativeVideoFullscreen } from '../use-ios-native-video-fullscreen';

/**
 * The composed tree media-chrome dispatches through: the request starts at the
 * fullscreen button inside `<media-controller>`, inside the player host's shadow
 * root. The controller listener stands in for the handler that would service the
 * request as element fullscreen when nothing claims it first.
 */
function mountPlayer({ supportsFullscreen = true }: { supportsFullscreen?: boolean } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const controller = document.createElement('div');
  host.attachShadow({ mode: 'open' }).append(controller);
  const button = document.createElement('button');
  controller.append(button);

  const webkitEnterFullscreen = vi.fn();
  const video = Object.assign(document.createElement('video'), {
    webkitSupportsFullscreen: supportsFullscreen,
    webkitEnterFullscreen,
  });
  Object.assign(host, { media: { nativeEl: video } });

  const serviced = vi.fn();
  controller.addEventListener('mediaenterfullscreenrequest', serviced);

  return {
    playerRef: { current: host as unknown },
    pressFullscreen: () =>
      button.dispatchEvent(new CustomEvent('mediaenterfullscreenrequest', { bubbles: true, composed: true })),
    serviced,
    webkitEnterFullscreen,
  };
}

function setShell(platform: 'ios' | 'android' | null): void {
  if (platform === null) {
    delete (globalThis as { Capacitor?: unknown }).Capacitor;
    return;
  }
  (globalThis as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => platform,
  };
}

afterEach(() => {
  setShell(null);
  document.body.innerHTML = '';
});

describe('useIosNativeVideoFullscreen', () => {
  it('hands the request to the system player instead of the fullscreen API', () => {
    setShell('ios');
    const { playerRef, pressFullscreen, serviced, webkitEnterFullscreen } = mountPlayer();
    renderHook(() => useIosNativeVideoFullscreen(playerRef));

    pressFullscreen();

    expect(webkitEnterFullscreen).toHaveBeenCalledTimes(1);
    // Stopped in the capture phase, so element fullscreen is never requested.
    expect(serviced).not.toHaveBeenCalled();
  });

  it('leaves the request to the player off the iOS shell', () => {
    setShell(null);
    const { playerRef, pressFullscreen, serviced, webkitEnterFullscreen } = mountPlayer();
    renderHook(() => useIosNativeVideoFullscreen(playerRef));

    pressFullscreen();

    expect(webkitEnterFullscreen).not.toHaveBeenCalled();
    expect(serviced).toHaveBeenCalledTimes(1);
  });

  it('leaves the request to the player on the Android shell', () => {
    setShell('android');
    const { playerRef, pressFullscreen, serviced, webkitEnterFullscreen } = mountPlayer();
    renderHook(() => useIosNativeVideoFullscreen(playerRef));

    pressFullscreen();

    expect(webkitEnterFullscreen).not.toHaveBeenCalled();
    expect(serviced).toHaveBeenCalledTimes(1);
  });

  // `webkitSupportsFullscreen` stays false until metadata loads — reachable on a
  // Save-Data connection, where preload is 'none'.
  it('leaves the request to the player while the video reports no fullscreen support', () => {
    setShell('ios');
    const { playerRef, pressFullscreen, serviced, webkitEnterFullscreen } = mountPlayer({
      supportsFullscreen: false,
    });
    renderHook(() => useIosNativeVideoFullscreen(playerRef));

    pressFullscreen();

    expect(webkitEnterFullscreen).not.toHaveBeenCalled();
    expect(serviced).toHaveBeenCalledTimes(1);
  });

  it('stops intercepting once unmounted', () => {
    setShell('ios');
    const { playerRef, pressFullscreen, serviced, webkitEnterFullscreen } = mountPlayer();
    const { unmount } = renderHook(() => useIosNativeVideoFullscreen(playerRef));

    unmount();
    pressFullscreen();

    expect(webkitEnterFullscreen).not.toHaveBeenCalled();
    expect(serviced).toHaveBeenCalledTimes(1);
  });
});
