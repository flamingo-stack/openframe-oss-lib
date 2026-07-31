package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushPlatform;

public interface CustomPushDeviceRepository {

    /**
     * The one operation Spring Data cannot derive: an atomic insert-or-rebind on the {tenantId, token}
     * unique index (an upsert). @return true when a new row was created.
     */
    boolean registerToken(String userId, String token, PushPlatform platform);
}
