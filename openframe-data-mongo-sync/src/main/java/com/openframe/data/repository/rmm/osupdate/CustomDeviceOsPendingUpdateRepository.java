package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;

import java.util.Collection;
import java.util.List;

public interface CustomDeviceOsPendingUpdateRepository {

    List<DeviceOsPendingUpdate> findDevicePage(String tenantId, OsPlatform platform, String identifier,
                                               Collection<String> excludedMachineIds, String cursor, int limit);

    String encodeDeviceCursor(DeviceOsPendingUpdate pendingUpdate);
}
