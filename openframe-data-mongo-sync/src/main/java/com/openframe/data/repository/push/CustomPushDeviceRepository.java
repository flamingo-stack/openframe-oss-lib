package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushPlatform;

import java.util.Collection;

public interface CustomPushDeviceRepository {

    /** Upserts by token, re-associating an existing one to the caller. @return true when a new row was created. */
    boolean registerToken(String userId, String token, PushPlatform platform);

    boolean removeToken(String token);

    long removeTokens(Collection<String> tokens);
}
