package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushPlatform;

import java.util.Collection;

public interface CustomPushDeviceRepository {

    /** Upserts by token, re-associating an existing one to the caller. @return true when a new row was created. */
    boolean registerToken(String userId, String token, PushPlatform platform);

    /** Scoped by userId so a caller cannot deregister a token that has been re-bound to someone else. */
    boolean removeToken(String userId, String token);

    long removeTokens(Collection<String> tokens);
}
