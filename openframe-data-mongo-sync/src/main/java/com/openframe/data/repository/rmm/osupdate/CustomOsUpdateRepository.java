package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;

import java.util.List;

public interface CustomOsUpdateRepository {

    List<OsUpdate> findPage(String tenantId, OsUpdateFilter filter, String cursor, int limit);

    String encodeCursor(OsUpdate osUpdate);
}
