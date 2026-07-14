package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.document.push.PushPlatform;

import java.util.Collection;
import java.util.List;

public interface CustomPushDeviceRepository {

    /**
     * Upserts by token, re-associating an existing one to the caller — a phone handed to another
     * user after logout must stop receiving the previous user's pushes.
     *
     * @return true when a new device row was created
     */
    boolean registerToken(String userId, String token, PushPlatform platform);

    List<PushDevice> findByUserId(String userId);

    boolean removeToken(String token);

    long removeTokens(Collection<String> tokens);
}
