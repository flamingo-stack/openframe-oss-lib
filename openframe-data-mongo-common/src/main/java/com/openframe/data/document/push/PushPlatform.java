package com.openframe.data.document.push;

/**
 * Platform a push token was issued for. With the FCM-for-both provider the token itself is
 * always an FCM registration token; the platform only tailors the payload (APNs vs Android
 * options) and is useful for diagnostics.
 */
public enum PushPlatform {
    IOS,
    ANDROID
}
