package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;

import java.util.Collection;
import java.util.List;

public interface CustomDeviceOsUpdateHistoryRepository {

    List<DeviceOsUpdateHistoryEntry> findPage(String tenantId, String machineId, String cursor, int limit);

    String encodeCursor(DeviceOsUpdateHistoryEntry historyEntry);

    List<OsUpdateDeviceCount> countInstalledDevicesByIdentifier(String tenantId, Collection<String> identifiers);

    List<InstalledOsUpdateDevice> findInstalledDevicePage(String tenantId, String identifier, String cursor, int limit);

    String encodeInstalledDeviceCursor(InstalledOsUpdateDevice installedDevice);
}
