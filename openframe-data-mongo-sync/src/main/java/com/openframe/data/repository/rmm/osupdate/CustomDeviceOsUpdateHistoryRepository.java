package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;

import java.util.List;

public interface CustomDeviceOsUpdateHistoryRepository {

    void insertMissing(List<DeviceOsUpdateHistoryEntry> historyEntries);

    List<DeviceOsUpdateHistoryEntry> findPage(String tenantId, String machineId, String cursor, int limit);

    String encodeCursor(DeviceOsUpdateHistoryEntry historyEntry);
}
