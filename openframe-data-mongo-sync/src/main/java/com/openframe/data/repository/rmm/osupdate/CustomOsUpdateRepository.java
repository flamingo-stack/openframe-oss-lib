package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;

import java.util.List;

public interface CustomOsUpdateRepository {

    void insertMissing(List<OsUpdate> osUpdates);
}
