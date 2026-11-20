package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;

import java.util.Collection;
import java.util.List;

public interface CustomDeviceOsUpdateHistoryRepository {

    List<String> findEntryKeys(String tenantId, String machineId, Collection<String> entryKeys);

    List<DeviceOsUpdateHistoryEntry> findPage(String tenantId, String machineId, String cursor, int limit);

    String encodeCursor(DeviceOsUpdateHistoryEntry entry);
}
