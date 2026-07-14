package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.document.push.PushPlatform;

import java.util.Collection;
import java.util.List;

public interface CustomPushDeviceRepository {

    /**
     * Registers a push token for the given user, creating the device row or re-associating an
     * existing token to the caller (a device handed to another user after logout must stop
     * receiving the previous user's pushes).
     *
     * @return true when a new device row was created, false when an existing token was re-associated
     */
    boolean registerToken(String userId, String token, PushPlatform platform);

    /** All devices currently registered for the user — the fan-out set for a push. */
    List<PushDevice> findByUserId(String userId);

    /** Explicit unregister (logout). */
    boolean removeToken(String token);

    /** Drops tokens a provider reported as permanently dead (unregistered / invalid). */
    long removeTokens(Collection<String> tokens);
}
