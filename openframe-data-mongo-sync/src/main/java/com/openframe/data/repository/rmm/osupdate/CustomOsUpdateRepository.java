package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;

import java.time.Instant;
import java.util.List;

public interface CustomOsUpdateRepository {

    List<OsUpdate> findPage(String tenantId, OsUpdateFilter filter, String cursor, int limit);

    String encodeCursor(OsUpdate osUpdate);

    // Never enriched or enriched before the given time, by id ascending; afterId null = from the first.
    List<OsUpdate> findEnrichedBefore(String tenantId, Instant enrichedBefore, String afterId, int limit);
}
