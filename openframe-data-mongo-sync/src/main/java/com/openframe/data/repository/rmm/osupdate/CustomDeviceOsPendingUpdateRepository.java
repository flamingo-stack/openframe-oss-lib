package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;

import java.util.List;

public interface CustomDeviceOsPendingUpdateRepository {

    void upsertKeepingDiscoveredAt(List<DeviceOsPendingUpdate> pendingUpdates);
}
