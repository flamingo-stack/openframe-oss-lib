'use client';

/**
 * iOS app shell only: hand the player's fullscreen control to Apple's own video
 * player instead of the Fullscreen API.
 *
 * This is what media-chrome already does on iPhone Safari — `requestFullscreen`
 * does not exist on `Element.prototype` there, so its `enterFullscreen` falls
 * through to `media.webkitEnterFullscreen()` and the video is handed to the
 * system player. The Capacitor shell turns element fullscreen ON (WKWebView's
 * `isElementFullscreenEnabled`), so media-chrome takes the `requestFullscreen()`
 * branch instead — and WebKit then hands the web view back with its scroll
 * view's `contentInsetAdjustmentBehavior` reset from Capacitor's `.never` to
 * `.automatic` and its own `safeAreaInsets` stranded at the fullscreen
 * container's values. The app comes back from a video with a doubled top band
 * and dead space above the home indicator until a rotation, and the shell can
 * only paper over it afterwards (`MainViewController` KVOs `fullscreenState` to
 * restore the behavior). Never entering element fullscreen is the actual fix.
 *
 * The takeover is an event interception, not a monkey-patch: the fullscreen
 * button dispatches `mediaenterfullscreenrequest` (`composed`, `bubbles`) from
 * inside the player's shadow trees, so a CAPTURE listener on the `<mux-player>`
 * host sees it before the `<media-controller>` that would service it, and
 * `stopImmediatePropagation()` is enough to claim the request. Which element
 * media-chrome would have passed to `requestFullscreen` never enters into it.
 *
 * The player's own fullscreen STATE stays correct for free: the system player
 * fires `webkitbeginfullscreen` / `webkitendfullscreen` on the `<video>`,
 * `mux-video` re-dispatches both, and media-chrome's state mediator already
 * listens for them.
 *
 * Anything the takeover cannot service falls through to media-chrome untouched:
 * no `<video>` yet, or `webkitSupportsFullscreen` still false — it stays false
 * until metadata has loaded, which is reachable on a Save-Data connection where
 * preload is `'none'`.
 */

import { useEffect } from 'react';

/** media-chrome's `MediaUIEvents.MEDIA_ENTER_FULLSCREEN_REQUEST`. Spelled out
 *  rather than imported: media-chrome is a transitive dep of the Mux player, not
 *  a declared one. */
const ENTER_FULLSCREEN_REQUEST = 'mediaenterfullscreenrequest';

/** The two `HTMLVideoElement` members WebKit adds for its own video-fullscreen
 *  presentation — absent from the DOM lib, and absent at runtime off Apple. */
interface NativeFullscreenVideo extends HTMLVideoElement {
  webkitSupportsFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

/** Gated on the shell, not on the platform: element fullscreen behaves fine in
 *  Safari (iPad) and on the desktop shell, where taking it away would only cost
 *  the player its chrome in fullscreen. */
function isIosAppShell(): boolean {
  const capacitor = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return capacitor?.isNativePlatform?.() === true && capacitor.getPlatform?.() === 'ios';
}

/** The real `<video>` behind `<mux-player>`: `player.media` is the `<mux-video>`
 *  custom element and `nativeEl` is the element WebKit presents. */
function nativeVideoElement(player: EventTarget): NativeFullscreenVideo | null {
  const media = (player as { media?: { nativeEl?: unknown } | null }).media;
  const element = media?.nativeEl ?? media;
  return element instanceof HTMLVideoElement ? element : null;
}

export function useIosNativeVideoFullscreen(playerRef: { current: unknown }): void {
  useEffect(() => {
    if (!isIosAppShell()) return;
    const player = playerRef.current;
    if (!(player instanceof EventTarget)) return;

    const takeOver = (event: Event) => {
      const video = nativeVideoElement(player);
      if (!video?.webkitSupportsFullscreen || typeof video.webkitEnterFullscreen !== 'function') return;
      event.stopImmediatePropagation();
      video.webkitEnterFullscreen();
    };

    player.addEventListener(ENTER_FULLSCREEN_REQUEST, takeOver, true);
    return () => player.removeEventListener(ENTER_FULLSCREEN_REQUEST, takeOver, true);
  }, [playerRef]);
}
